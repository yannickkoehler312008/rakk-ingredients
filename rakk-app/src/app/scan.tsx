import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { goBack } from '../services/navigation';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { useRef as useReactRef } from 'react';
import Feather from '@expo/vector-icons/Feather';
import { color, gutter, radius, scrim, space } from '../theme/tokens';
import { mono, sans, serif } from '../theme/type';
import { PrimaryButton, SecondaryButton } from '../components/primitives';
import { ScanProgress, ScanStep } from '../components/states';
import { lookupBarcode } from '../services/openFoodFacts';
import { resolveScan } from '../services/matcher';
import { readLabelPhoto } from '../services/ocr';
import { ConfirmLabelText } from '../components/ConfirmLabelText';
import { SEED_INGREDIENTS } from '../data/seed';
import { getCached, recordScan } from '../services/scanStore';

/**
 * Scan — §4, now live (build-order step 2).
 *
 *  - Camera view with a framing guide for barcode or ingredient-panel capture
 *  - Manual search fallback, because §4 says "always give the user an out"
 *
 * §8: barcode DETECTION is fully on-device and needs no network. Only the
 * lookup does. So detection is allowed to succeed offline and the network
 * failure surfaces at the lookup step, with its own designed state — not as a
 * camera that appears broken.
 *
 * Still to come: the ingredients-panel mode is a photo/OCR path (step 6), so it
 * is visible but not yet wired.
 */

type Mode = 'barcode' | 'panel';

/** What the screen is doing right now. Each is a designed state, per §9. */
type Phase =
  | { kind: 'scanning' }
  /** §4's "always give the user an out" when the camera can't get a read. */
  | { kind: 'manual' }
  /** §8: the OCR path is slower than barcode and needs its own progress state. */
  | { kind: 'reading' }
  /** The transcription, shown for confirmation before it is matched. */
  | { kind: 'confirm'; text: string; markers: number }
  /** §9's designed "OCR failed" state, carrying the real reason. */
  | { kind: 'unreadable'; reason: string }
  | { kind: 'working'; step: ScanStep; barcode: string }
  | { kind: 'not_found'; barcode: string }
  | { kind: 'no_ingredients'; name: string; brand: string }
  | { kind: 'offline'; barcode: string }
  | { kind: 'error'; detail: string };

const BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e'] as const;

export default function Scan() {
  const [mode, setMode] = useState<Mode>('barcode');
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<Phase>({ kind: 'scanning' });

  // The camera fires continuously while a barcode is in frame; without this a
  // single scan would launch a dozen lookups.
  const busy = useRef(false);
  const cameraRef = useReactRef<CameraView | null>(null);

  /**
   * §6's photo path. Capture, send for transcription, then show the reading
   * for confirmation before anything is matched — see ConfirmLabelText for
   * why that step exists.
   */
  const capturePanel = useCallback(async () => {
    if (busy.current || !cameraRef.current) return;
    busy.current = true;
    setPhase({ kind: 'reading' });

    let uri: string | undefined;
    try {
      const shot = await cameraRef.current.takePictureAsync({ quality: 0.9, skipProcessing: true });
      uri = shot?.uri;
    } catch {
      busy.current = false;
      setPhase({ kind: 'error', detail: 'the camera could not take a photo' });
      return;
    }
    if (!uri) {
      busy.current = false;
      setPhase({ kind: 'error', detail: 'the camera returned no photo' });
      return;
    }

    const result = await readLabelPhoto(uri);
    busy.current = false;

    switch (result.kind) {
      case 'text':
        setPhase({ kind: 'confirm', text: result.raw_ingredient_text, markers: result.unreadable_markers });
        return;
      case 'unreadable':
        setPhase({ kind: 'unreadable', reason: result.reason });
        return;
      case 'offline':
        setPhase({ kind: 'offline', barcode: '' });
        return;
      case 'rate_limited':
        setPhase({ kind: 'error', detail: result.detail ?? 'too many photos for now' });
        return;
      case 'not_configured':
        setPhase({ kind: 'error', detail: 'reading photos is not switched on in this build' });
        return;
      case 'unauthenticated':
        setPhase({ kind: 'error', detail: 'could not start a session' });
        return;
      default:
        setPhase({ kind: 'error', detail: result.detail ?? 'that did not go through' });
    }
  }, []);

  /**
   * A confirmed transcription goes through exactly the same matcher as a
   * barcode scan (§10 step 6 is a new input, not a second pipeline).
   */
  const acceptTranscription = useCallback(async (text: string) => {
    const scan = resolveScan(
      {
        id: `ocr_${Date.now()}`,
        barcode: null,
        name: 'Photographed label',
        brand: '',
        image_url: null,
        raw_ingredient_text: text,
      },
      SEED_INGREDIENTS,
      'photo_ocr',
    );
    await recordScan(scan);
    busy.current = false;
    router.replace({ pathname: '/label', params: { scanId: scan.scan_id } });
  }, []);

  /** One path, whether the barcode came from the camera or was typed in. */
  const runLookup = useCallback(async (barcode: string) => {
    busy.current = true;
    setPhase({ kind: 'working', step: 'read', barcode });

    // §8: a product scanned before resolves with zero network.
    const cached = await getCached(barcode);
    if (cached) {
      // Re-scanning moves the existing entry to the top of history with a
      // fresh timestamp. Keep its scan_id: history dedupes by product, so
      // minting a new id here would strand the row we then navigate to.
      const replay = { ...cached, scanned_at: new Date().toISOString() };
      await recordScan(replay);
      busy.current = false;
      router.replace({ pathname: '/label', params: { scanId: replay.scan_id } });
      return;
    }

    setPhase({ kind: 'working', step: 'lookup', barcode });
    const result2 = await lookupBarcode(barcode);

    switch (result2.kind) {
      case 'found': {
        // §7's one assembled response: product + matched ingredients + the
        // flagged subset, built here only because there is no backend yet.
        const scan = resolveScan(result2.product, SEED_INGREDIENTS);
        await recordScan(scan);
        busy.current = false;
        router.replace({ pathname: '/label', params: { scanId: scan.scan_id } });
        return;
      }
      case 'no_ingredients':
        setPhase({
          kind: 'no_ingredients',
          name: result2.product.name,
          brand: result2.product.brand,
        });
        return;
      case 'not_found':
        setPhase({ kind: 'not_found', barcode });
        return;
      case 'offline':
        setPhase({ kind: 'offline', barcode });
        return;
      case 'error':
        setPhase({ kind: 'error', detail: result2.detail });
        return;
    }
  }, []);

  const handleBarcode = useCallback(
    (result: BarcodeScanningResult) => {
      if (busy.current) return;
      const barcode = result.data?.trim();
      if (!barcode) return;
      runLookup(barcode);
    },
    [runLookup],
  );

  const resume = () => {
    busy.current = false;
    setPhase({ kind: 'scanning' });
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  // Expo hasn't resolved the permission yet; a blank ground beats a flash.
  if (!permission) return <View style={s.root} />;

  const granted = permission.granted;

  // The camera being unavailable must never trap the user. §4: "always give the
  // user an out" — so a denied camera still reaches manual barcode entry, and
  // the permission gate is only shown while we're actually trying to scan.
  const showGate = !granted && phase.kind === 'scanning';

  return (
    <View style={[s.root, !granted && s.rootLight]}>
      {granted ? (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
          onBarcodeScanned={
            mode === 'barcode' && phase.kind === 'scanning' ? handleBarcode : undefined
          }
        />
      ) : null}

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={s.topBar}>
          <Pressable onPress={() => goBack()} hitSlop={14} accessibilityRole="button">
            <Feather name="x" size={22} color={granted ? color.surface : color.text} />
          </Pressable>
          <Text style={[sans.bodyStrong, { color: granted ? color.surface : color.text }]}>
            Scan a label
          </Text>
          <View style={{ width: 22 }} />
        </View>

        {granted ? (
          <>
            <View style={s.modeRow}>
              <ModeTab
                label="Barcode"
                active={mode === 'barcode'}
                onPress={() => {
                  setMode('barcode');
                  resume();
                }}
              />
              <ModeTab
                label="Ingredients panel"
                active={mode === 'panel'}
                onPress={() => setMode('panel')}
              />
            </View>

            <View style={s.stage}>
              <View style={[s.frame, mode === 'panel' ? s.framePanel : s.frameBarcode]}>
                <Corner style={{ top: -1, left: -1 }} corner="tl" />
                <Corner style={{ top: -1, right: -1 }} corner="tr" />
                <Corner style={{ bottom: -1, left: -1 }} corner="bl" />
                <Corner style={{ bottom: -1, right: -1 }} corner="br" />
              </View>
              <Text style={[sans.meta, s.hint]}>
                {mode === 'panel'
                  ? 'Fit the whole ingredients panel in the frame, as square-on as you can.'
                  : 'Line the barcode up inside the frame.'}
              </Text>
            </View>

            <View style={s.bottom}>
              {mode === 'panel' ? (
                <Pressable
                  onPress={capturePanel}
                  style={s.shutter}
                  accessibilityRole="button"
                  accessibilityLabel="Photograph the ingredients panel"
                >
                  <View style={s.shutterInner} />
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => setPhase({ kind: 'manual' })}
                style={s.fallback}
                accessibilityRole="button"
              >
                <Feather name="edit-3" size={15} color={color.surface} />
                <Text style={[sans.metaStrong, { color: color.surface, marginLeft: space.sm }]}>
                  Enter the barcode instead
                </Text>
              </Pressable>
            </View>
          </>
        ) : (
          <View style={{ flex: 1 }} />
        )}
      </SafeAreaView>

      {showGate ? (
        <PermissionGate
          canAsk={permission.canAskAgain}
          onAsk={requestPermission}
          onManual={() => setPhase({ kind: 'manual' })}
        />
      ) : null}

      {phase.kind === 'confirm' ? (
        <View style={s.fullOverlay}>
          <ConfirmLabelText
            initialText={phase.text}
            unreadableMarkers={phase.markers}
            onConfirm={acceptTranscription}
            onRetake={resume}
            onCancel={resume}
          />
        </View>
      ) : phase.kind !== 'scanning' ? (
        <ResultSheet phase={phase} onDismiss={resume} onSubmitBarcode={runLookup} />
      ) : null}
    </View>
  );
}

/**
 * §9: the camera permission is its own designed state, in both variants —
 * "we haven't asked yet" and "you said no and the OS won't ask again".
 */
function PermissionGate({
  canAsk,
  onAsk,
  onManual,
}: {
  canAsk: boolean;
  onAsk: () => void;
  onManual: () => void;
}) {
  return (
    <View style={s.sheetWrap} pointerEvents="box-none">
      <View style={s.sheet}>
        <View style={s.gateIcon}>
          <Feather name="camera" size={18} color={color.primary} />
        </View>
        <Text style={[serif.cardTitle, { marginTop: space.md }]}>
          {canAsk ? 'Rakk needs the camera to read a label.' : 'Camera access is switched off.'}
        </Text>
        <Text style={[sans.body, { marginTop: space.sm, color: color.textMuted }]}>
          {canAsk
            ? 'It reads the barcode on the package. Nothing is recorded and no photo is saved.'
            : 'Turn the camera back on for Rakk in your device settings, or type the barcode in by hand.'}
        </Text>
        <View style={{ marginTop: space.lg }}>
          {canAsk ? <PrimaryButton label="Allow the camera" onPress={onAsk} /> : null}
          <View style={{ height: canAsk ? space.md : 0 }} />
          {canAsk ? (
            <SecondaryButton label="Enter the barcode instead" onPress={onManual} />
          ) : (
            <PrimaryButton label="Enter the barcode instead" onPress={onManual} />
          )}
        </View>
      </View>
    </View>
  );
}

/** Progress and outcomes sit over the live preview rather than replacing it. */
function ResultSheet({
  phase,
  onDismiss,
  onSubmitBarcode,
}: {
  phase: Phase;
  onDismiss: () => void;
  onSubmitBarcode: (barcode: string) => void;
}) {
  return (
    <View style={s.sheetWrap} pointerEvents="box-none">
      <View style={s.sheet}>
        {phase.kind === 'manual' ? (
          <ManualEntry onSubmit={onSubmitBarcode} onCancel={onDismiss} />
        ) : null}

        {/* §8: OCR is slower than a barcode read, so it gets its own progress
            rather than sharing the barcode sequence. */}
        {phase.kind === 'reading' ? (
          <>
            <Text style={sans.sectionLabel}>Reading the panel</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: space.base }}>
              <ActivityIndicator size="small" color={color.primary} />
              <Text style={[sans.body, { marginLeft: space.md, color: color.textMuted }]}>
                Transcribing what&apos;s printed on the package…
              </Text>
            </View>
          </>
        ) : null}

        {phase.kind === 'unreadable' ? (
          <Outcome
            icon="image"
            title="We couldn't read that label."
            body={`${phase.reason.charAt(0).toUpperCase()}${phase.reason.slice(1)}. More light helps, and so does getting the whole panel square-on in the frame.`}
            primary={{ label: 'Take another photo', onPress: onDismiss }}
          />
        ) : null}

        {phase.kind === 'working' ? (
          <>
            <Text style={sans.sectionLabel}>Reading the label</Text>
            <ScanProgress current={phase.step} />
          </>
        ) : null}

        {phase.kind === 'not_found' ? (
          <Outcome
            icon="search"
            title="We don't have this barcode yet."
            body="It isn't in the product database. You can photograph the ingredients panel instead, and we'll read the list off the package."
            code={phase.barcode}
            primary={{ label: 'Try another label', onPress: onDismiss }}
          />
        ) : null}

        {phase.kind === 'no_ingredients' ? (
          <Outcome
            icon="file-text"
            title="We found the product, but not its ingredient list."
            body={`${phase.name}${phase.brand ? ` · ${phase.brand}` : ''} is in the database, but nobody has added its label yet. Photographing the panel will read it straight off the package.`}
            primary={{ label: 'Try another label', onPress: onDismiss }}
          />
        ) : null}

        {phase.kind === 'offline' ? (
          <Outcome
            icon="cloud-off"
            title="No connection."
            body="We'll look this up as soon as you're back online. Anything you've scanned before still opens instantly."
            code={phase.barcode}
            primary={{ label: 'Try again', onPress: onDismiss }}
          />
        ) : null}

        {phase.kind === 'error' ? (
          <Outcome
            icon="alert-circle"
            title="That lookup didn't go through."
            body="The product database didn't answer. It's worth another try in a moment."
            code={phase.detail}
            primary={{ label: 'Try again', onPress: onDismiss }}
          />
        ) : null}
      </View>
    </View>
  );
}

/**
 * Typing the number off the package. Searching by product NAME is a separate
 * piece of work (it needs the Open Food Facts search endpoint and a result
 * list) and isn't built yet — this is the minimum honest out for step 2.
 */
function ManualEntry({
  onSubmit,
  onCancel,
}: {
  onSubmit: (barcode: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState('');
  const digits = value.replace(/[^0-9]/g, '');
  const valid = digits.length >= 8;

  return (
    <View>
      <Text style={sans.sectionLabel}>Enter the barcode</Text>
      <Text style={[sans.body, { marginTop: space.sm, color: color.textMuted }]}>
        The long number under the bars on the package.
      </Text>
      <TextInput
        value={value}
        onChangeText={setValue}
        keyboardType="number-pad"
        autoFocus
        maxLength={14}
        placeholder="0000000000000"
        placeholderTextColor={color.textMuted}
        style={s.input}
        accessibilityLabel="Barcode number"
      />
      <View style={{ marginTop: space.base }}>
        <PrimaryButton
          label="Look it up"
          onPress={() => {
            if (!valid) return;
            Keyboard.dismiss();
            onSubmit(digits);
          }}
        />
        <View style={{ height: space.md }} />
        <SecondaryButton label="Back to the camera" onPress={onCancel} />
      </View>
    </View>
  );
}

function Outcome({
  icon,
  title,
  body,
  code,
  primary,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  title: string;
  body: string;
  code?: string;
  primary: { label: string; onPress: () => void };
}) {
  return (
    <View>
      <View style={s.gateIcon}>
        <Feather name={icon} size={18} color={color.primary} />
      </View>
      <Text style={[serif.cardTitle, { marginTop: space.md }]}>{title}</Text>
      <Text style={[sans.body, { marginTop: space.sm, color: color.textMuted }]}>{body}</Text>
      {code ? <Text style={[mono.citation, { marginTop: space.sm, color: color.textMuted }]}>{code}</Text> : null}
      <View style={{ marginTop: space.lg }}>
        <PrimaryButton label={primary.label} onPress={primary.onPress} />
      </View>
    </View>
  );
}

function ModeTab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.modeTab, active ? s.modeTabActive : null]}>
      <Text style={[sans.metaStrong, { color: active ? color.text : scrim.onDarkMuted }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function Corner({ corner, style }: { corner: 'tl' | 'tr' | 'bl' | 'br'; style?: object }) {
  const w = 2.5;
  const len = 26;
  return (
    <View
      style={[
        { position: 'absolute', width: len, height: len, borderColor: color.surface },
        corner === 'tl' && { borderTopWidth: w, borderLeftWidth: w, borderTopLeftRadius: 5 },
        corner === 'tr' && { borderTopWidth: w, borderRightWidth: w, borderTopRightRadius: 5 },
        corner === 'bl' && { borderBottomWidth: w, borderLeftWidth: w, borderBottomLeftRadius: 5 },
        corner === 'br' && { borderBottomWidth: w, borderRightWidth: w, borderBottomRightRadius: 5 },
        style,
      ]}
    />
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.text },
  rootLight: { backgroundColor: color.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: gutter,
    paddingVertical: space.md,
  },
  modeRow: {
    flexDirection: 'row',
    alignSelf: 'center',
    backgroundColor: scrim.controlBg,
    borderRadius: radius.pill,
    padding: 3,
  },
  modeTab: { paddingHorizontal: space.base, paddingVertical: 7, borderRadius: radius.pill },
  modeTabActive: { backgroundColor: color.bg },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: gutter },
  frame: { borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  frameBarcode: { width: '100%', aspectRatio: 1.7 },
  framePanel: { width: '100%', aspectRatio: 0.82 },
  hint: { color: scrim.onDarkMuted, marginTop: space.lg, textAlign: 'center' },
  bottom: { alignItems: 'center', paddingBottom: space.md },
  shutter: {
    width: 68,
    height: 68,
    borderRadius: radius.pill,
    borderWidth: 3,
    borderColor: scrim.shutterRing,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: color.surface,
  },
  fallback: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: space.lg,
    paddingVertical: space.sm,
  },
  gateIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: color.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    marginTop: space.base,
    backgroundColor: color.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.border,
    paddingHorizontal: space.base,
    paddingVertical: 14,
    fontFamily: 'IBMPlexMono_500Medium',
    fontSize: 18,
    letterSpacing: 1.5,
    color: color.text,
  },
  fullOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: color.bg,
  },
  sheetWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: color.bg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: space.lg,
    paddingBottom: space.xxl,
  },
});
