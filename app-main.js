// Keyboard testing removed

// ==================== GLOBAL VARIABLES ====================

let odysseyClient;
let isConnected = false;
let isStreaming = false;
let interactionCount = 0;

// Audio Analysis
let audioContext;
let analyser;
let microphone;
let audioDataArray;
let audioBufferLength;
let audioAnalysisFrameId = null;
let audioAnalysisTimeoutId = null;
let currentAudioFeatures = {
    volume: 0,        // 0-100
    pitch: 'mid',     // 'low', 'mid', 'high'
    energy: 0,        // 0-100
    rhythm: 'normal'  // 'slow', 'normal', 'fast'
};

// Advanced audio tracking for dramatic effects
let volumeHistory = [];
let previousVolume = 0;
let loudDuration = 0;
let quietDuration = 0;
let isPaused = false;

// Peak audio tracking during speech
let isSpeaking = false;
let speechAudioPeaks = {
    maxVolume: 0,
    maxEnergy: 0,
    dominantPitch: 'mid',
    avgVolume: 0,
    volumeSamples: []
};

// Speech Recognition
let recognition;
let speechEnabled = true;
let recentWords = [];
let lastVoiceInteractionTime = 0;
let lastAudioEventTime = 0;
const VOICE_INTERACTION_INTERVAL = 2000; // 2 seconds for voice
const AUDIO_EVENT_INTERVAL = 5000; // 5 seconds for audio events
let temporaryMuteUntil = 0; // Timestamp to temporarily mute speech recognition
let speechDraftAnimationFrame = null;
let pendingSpeechDraftUpdate = null;
let lastPointingVoicePrimeAt = 0;
let latestSpeechMeta = createEmptySpeechMeta();

// Hand Gesture Control
let hands;
let camera;
let handTrackingAnimationFrame = null;
let handGestureEnabled = true;
let currentGesture = null;
let handInferenceInFlight = false;
let handTrackingStartInFlight = false;
let handTrackerRecovering = false;
let lastHandTrackerFatalAt = 0;

// Face Emotion Detection
let faceDetectionEnabled = true;
let currentEmotion = 'neutral';
let emotionConfidence = 0;
let faceDetectionInterval = null;
let faceDetectionStartInFlight = false;
const emotionEmojis = {
    happy: '😊',
    sad: '😢',
    angry: '😠',
    fearful: '😨',
    disgusted: '🤢',
    surprised: '😲',
    neutral: '😐'
};

// Emotion intensity mapping: [60-75%, 75-90%, 90%+]
const emotionAdjectives = {
    happy: ['cute', 'cheerful', 'happy', 'joyful', 'delighted', 'ecstatic'],
    sad: ['gloomy', 'melancholic', 'sad', 'sorrowful', 'depressed', 'heartbroken'],
    angry: ['grumpy', 'annoyed', 'angry', 'fierce', 'furious', 'enraged'],
    fearful: ['nervous', 'worried', 'fearful', 'scared', 'terrified', 'horrified'],
    disgusted: ['displeased', 'uncomfortable', 'disgusted', 'repulsed', 'revolted', 'sickened'],
    surprised: ['curious', 'intrigued', 'surprised', 'amazed', 'astonished', 'shocked'],
    neutral: [] // No adjectives for neutral
};

// Get appropriate adjective based on emotion and intensity
function getEmotionAdjective(emotion, confidence) {
    const adjectives = emotionAdjectives[emotion] || [];
    if (adjectives.length === 0) return null; // neutral
    
    // Map confidence to adjective: 60-75% → first 2, 75-90% → middle 2, 90%+ → last 2
    const percent = confidence * 100;
    let pool;
    if (percent < 75) {
        pool = adjectives.slice(0, 2); // gentle
    } else if (percent < 90) {
        pool = adjectives.slice(2, 4); // moderate
    } else {
        pool = adjectives.slice(4, 6); // intense
    }
    
    // Random pick from pool
    return pool[Math.floor(Math.random() * pool.length)];
}

// Finger Pointer / Click-Grounded Editing
let isPointing = false;
let fingerCursorPos = { x: 0, y: 0 }; // Normalized 0-1
let lastClickPos = null; // { xPercent, yPercent }
let lastClickFrameData = null; // { fullFrame, zoomFrame }
let visionResult = null; // Last vision API result
let lastClickTargetCardId = null;
let hoverPointerCardId = null;
let pinchDragState = null; // Active pinch drag session for a card
let pinchDetectedFrames = 0;
let pinchReleaseFrames = 0;
let grabDetectedFrames = 0;
let grabReleaseFrames = 0;
let pinchAimOffset = null;
let pinchAimFilteredViewport = null;
let handMissedFrames = 0;
let lastCameraRecoveryAttempt = 0;
let mouseHoverCardId = null;
let dotHoverCardId = null;
let globalHandCursorEl = null;
let lastPointAimViewport = null;
let lastPointAimTimestamp = 0;
let lastPinchDistanceSample = Infinity;
const handCursorMotionState = {
    active: false,
    mode: 'neutral',
    x: 0,
    y: 0,
    rawX: 0,
    rawY: 0,
    lastTs: 0,
    vx: 0,
    vy: 0
};
const CARD_VOICE_AIM_MAX_AGE_MS = 2500;
const cardVoiceAimState = {
    cardId: null,
    xNorm: 0.5,
    yNorm: 0.5,
    timestamp: 0,
    source: ''
};
let canvasVoicePromptEl = null;
let canvasVoicePromptEligibleSince = 0;
const emptyCanvasVoicePromptState = {
    visible: false,
    eligible: false,
    locked: false,
    canvasX: 0,
    canvasY: 0,
    text: '',
    textMode: 'idle'
};

const NON_CANVAS_POINTER_SELECTOR = '.top-bar, .speech-pill, .senses-panel, .debug-sidebar, input, textarea, button, label';
const CANVAS_VOICE_IDLE_HINT_DELAY_MS = 3000;
const PANEL_VISIBILITY_TRANSITION_MS = 180;
const panelHideTimers = new WeakMap();
let instructionBannerAutoHideTimer = null;
let instructionBannerHiddenForSession = false;
let isMinimalUiMode = true;
let isPromptBarVisible = true;
let currentThemeMode = 'light';

const PINCH_START_DISTANCE = 0.055;
const PINCH_RELEASE_DISTANCE = 0.082;
const PINCH_RELEASE_GRACE_DISTANCE = 0.01;
const PINCH_RELEASE_TOLERANCE_FRAMES = 2;
const PINCH_STABLE_FRAMES = 2;
const PINCH_SMOOTHING_BASE = 0.42;
const PINCH_SMOOTHING_FAST = 0.78;
const PINCH_FAST_DELTA_PX = 18;
const PINCH_POSITION_LERP_BASE = 0.76;
const PINCH_POSITION_LERP_FAST = 0.94;
const PINCH_CATCHUP_DISTANCE_PX = 28;
const PINCH_SNAP_DISTANCE_PX = 92;
const PINCH_POSITION_DEADZONE_PX = 0.6;
const PINCH_AIM_RECENT_POINTING_MS = 320;
const PINCH_AIM_FILTER = 0.52;
const PINCH_AIM_MAX_OFFSET_PX = 120;
const PINCH_INDEX_PROJECTION = 1.35;
const PINCH_AIM_PROJECT_BLEND = 0.72;
const PINCH_START_ASSIST_DISTANCE = 0.012;
const PINCH_CLOSE_DELTA_THRESHOLD = 0.0045;
const GRAB_STABLE_FRAMES = 2;
const GRAB_RELEASE_TOLERANCE_FRAMES = 3;
const HAND_SCORE_THRESHOLD = 0.35;
const HAND_MISS_TOLERANCE_FRAMES = 3;
const CURSOR_STATE_TIMEOUT_MS = 260;
const CURSOR_FAST_SPEED_PX_PER_MS = 1.05;
const CURSOR_PREDICT_LEAD_MAX_PX = 24;
const HAND_VIDEO_MIN_DIMENSION_PX = 16;
const HAND_TRACKER_FATAL_RESTART_COOLDOWN_MS = 1200;
const POINTING_VOICE_PRIME_INTERVAL_MS = 850;
const RECENT_POINTING_VOICE_CONTEXT_MS = 1800;
const SPEECH_RESULT_MAX_ALTERNATIVES = 5;
const SPEECH_ALT_PRIMARY_KEEP_THRESHOLD = 0.7;
const SPEECH_ALT_MIN_CONFIDENCE_ADVANTAGE = 0.24;
const SPEECH_ALT_MIN_SCORE_ADVANTAGE = 0.04;
const SPEECH_HINT_MAX_SCORE_BONUS = 0.03;
const SPEECH_HINT_SCORE_STEP = 0.008;
const SPEECH_HINT_TOKEN_LIMIT = 40;
const SPEECH_PHRASE_HINT_LIMIT = 20;
const SPEECH_PHRASE_HINT_BOOST = 1.45;
const SPEECH_EMOTION_CONFIDENCE_THRESHOLD = 0.55;
const SPEECH_AUDIO_LOUD_THRESHOLD = 62;
const SPEECH_AUDIO_QUIET_THRESHOLD = 14;
const SPEECH_AUDIO_HIGH_ENERGY_THRESHOLD = 66;
const SPEECH_AUDIO_LOW_ENERGY_THRESHOLD = 22;

const BASE_SPEECH_HINT_PHRASES = [
    'add',
    'remove',
    'change',
    'replace',
    'make it',
    'move camera',
    'zoom in',
    'zoom out',
    'left side',
    'right side',
    'foreground',
    'background',
    'bird',
    'cat',
    'dog',
    'car',
    'tree',
    'river',
    'mountain',
    'city',
    'cinematic'
];
let speechPhraseHintsEnabled = true;
let speechGrammarHintsEnabled = false;
let speechPhraseUnsupportedLogged = false;
let speechGrammarUnsupportedLogged = false;

const CHIP_SLOT_STEP_X = 78;
const CHIP_SLOT_STEP_Y = 62;
const CHIP_BASE_GAP_PX = 14;
const CHIP_RING_STEP_PX = 12;
const CHIP_MAX_RING = 3;
const CHIP_MAX_DISTANCE_PX = 58;
const CHIP_COLLISION_PADDING_BASE = 8;
const CHIP_VIEWPORT_MARGIN = 14;
const CHIP_MIN_TEXT_LENGTH = 1;
const UI_MINIMAL_MODE_STORAGE_KEY = 'wander_ui_minimal_mode';
const PROMPT_BAR_VISIBLE_STORAGE_KEY = 'wander_prompt_bar_visible';
const THEME_MODE_STORAGE_KEY = 'wander_theme_mode';
const WELCOME_SEEN_SESSION_STORAGE_KEY = 'wander_welcome_seen_session';
const INSTRUCTION_BANNER_AUTO_HIDE_MS = 2800;
const INSTRUCTION_BANNER_HIDE_TRANSITION_MS = 220;
const CARD_STATUS_HISTORY_LIMIT = 5;
const STREAM_TELEMETRY_MAX_EVENTS = 80;
const REPLAY_CROSSFADE_MS = 280;

// Auto-evolution
let autoEvolutionInterval;
let storyContext = [];
const AUTO_EVOLUTION_INTERVAL = 6000; // 6 seconds auto-evolution (faster!)

// Scene state tracking
let initialStoryline = ''; // Original starting scene
let currentSceneState = ''; // Current evolved state

// Keyboard controls removed

// ==================== DOM ELEMENTS ====================

const landingScreen = document.getElementById('landingScreen');
const videoSection = document.getElementById('appScreen');
const videoArea = document.getElementById('videoArea');
const videoCanvas = document.getElementById('videoCanvas');
const videoCard = document.getElementById('videoCard');
const videoElement = document.getElementById('videoElement');
const projectTitleInput = document.getElementById('projectTitle');
const newProjectTopBtn = document.getElementById('newProjectTopBtn');
const videoCardStatus = document.getElementById('videoCardStatus');
const removeVideoCardBtn = document.getElementById('removeVideoCard');
const sensesButton = document.getElementById('sensesButton');
const sensesPanel = document.getElementById('sensesPanel');
const promptInput = document.getElementById('promptInput');
const sendButton = document.getElementById('sendButton');
const senseVoice = document.getElementById('senseVoice');
const senseVision = document.getElementById('senseVision');
const senseGestures = document.getElementById('senseGestures');
const speechStatusEl = document.getElementById('speechStatus');
const speechHeardTextEl = document.getElementById('speechHeardText');
const speechAppliedTextEl = document.getElementById('speechAppliedText');
const promptModifierIconsEl = document.getElementById('promptModifierIcons');
const speechPillWrapperEl = document.querySelector('.speech-pill-wrapper');
const optionPromptBarToggleEl = document.getElementById('optionPromptBarToggle');
const optionThemeToggleEl = document.getElementById('optionThemeToggle');
const odysseyKeyGateEl = document.getElementById('odysseyKeyGate');
const odysseyKeyInputEl = document.getElementById('odysseyKeyInput');
const odysseyKeyStartBtn = document.getElementById('odysseyKeyStartBtn');
const odysseyKeyGateErrorEl = document.getElementById('odysseyKeyGateError');
const wanderWelcomeModalEl = document.getElementById('wanderWelcomeModal');
const wanderWelcomeCloseBtn = document.getElementById('wanderWelcomeCloseBtn');
const optionWelcomeReplayBtn = document.getElementById('optionWelcomeReplayBtn');
const instructionBannerEl = document.querySelector('.instruction-banner');
const instructionCloseBtn = document.getElementById('instructionCloseBtn');
const conceptsGridEl = document.getElementById('conceptsGrid');
const newProjectConceptBtn = document.getElementById('newProjectConceptBtn');
const streamStatus = document.getElementById('streamStatus');
const interactionCountEl = document.getElementById('interactionCount');
const generatingIndicator = document.getElementById('generatingIndicator');
const volumeValueEl = document.getElementById('volumeValue');
const pitchValueEl = document.getElementById('pitchValue');
const energyValueEl = document.getElementById('energyValue');
const emotionValueEl = document.getElementById('emotionValue');
const emotionEmojiEl = document.getElementById('emotionEmoji');
const emotionLabelEl = document.getElementById('emotionLabel');
const emotionPercentEl = document.getElementById('emotionPercent');
const gestureIndicator = document.getElementById('gestureIndicator');
const handVideo = document.getElementById('handVideo');
const handCanvas = document.getElementById('handCanvas');
const faceCanvas = document.getElementById('faceCanvas');

// Finger cursor & click DOM
const fingerCursorEl = document.getElementById('fingerCursor');
const clickMarkerEl = document.getElementById('clickMarker');
const videoDisplay = document.getElementById('videoDisplay');
const videoOverlayCanvas = document.getElementById('videoOverlayCanvas');

// Multi-card streaming state
const streamCards = new Map();
let streamCardCounter = 0;
let streamCardChipCounter = 0;
let nextCardOffset = 0;
let cardZIndex = 20;
const cardChipLayoutRaf = new Map();
let activeStreamType = null; // 'primary' | 'secondary'
let activeStreamCardId = null;
let suppressPrimaryAutoRestart = false;
let canvasPanX = 0;
let canvasPanY = 0;
let appSessionActive = false;
let voiceBootstrapInFlight = null;
let mediaWarmupInFlight = null;
let voiceRetryOnInteractionArmed = false;
let preAnalyzeAbortController = null;
let visionGroundAbortController = null;

const CARD_COORD_LIMIT = 50000;
const CANVAS_WHEEL_PAN_MULTIPLIER = 1;

const AUDIO_STREAM_CONSTRAINTS = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true
};

const VIDEO_STREAM_CONSTRAINTS = {
    width: { ideal: 640, max: 960 },
    height: { ideal: 360, max: 540 },
    frameRate: { ideal: 12, max: 15 },
    facingMode: 'user'
};

const FACE_API_SCRIPT_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/dist/face-api.min.js';
const FACE_API_MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';
const MEDIA_PIPE_SCRIPT_URLS = [
    'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js',
    'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js'
];

const DEBUG_LOGS = false;
function debugLog(...args) {
    if (DEBUG_LOGS) {
        console.log(...args);
    }
}

const streamTelemetry = [];
if (typeof window !== 'undefined') {
    window.wanderStreamTelemetry = streamTelemetry;
}

function recordStreamTelemetry(eventName, details = {}) {
    const safeDetails = {};
    Object.entries(details || {}).forEach(([key, value]) => {
        if (/token|key|password|credential/i.test(key)) return;
        if (typeof value === 'string') {
            safeDetails[key] = value.length > 240 ? `${value.slice(0, 240)}...` : value;
            return;
        }
        if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
            safeDetails[key] = value;
        }
    });

    const entry = {
        ts: Date.now(),
        event: String(eventName || 'event'),
        ...safeDetails
    };
    streamTelemetry.push(entry);
    if (streamTelemetry.length > STREAM_TELEMETRY_MAX_EVENTS) {
        streamTelemetry.splice(0, streamTelemetry.length - STREAM_TELEMETRY_MAX_EVENTS);
    }
    debugLog('[stream]', entry.event, safeDetails);
    return entry;
}

function detectRuntimeProfile() {
    const nav = typeof navigator !== 'undefined' ? navigator : {};
    const connection = nav.connection || nav.mozConnection || nav.webkitConnection;
    const effectiveType = String(connection?.effectiveType || '').toLowerCase();
    const saveData = Boolean(connection?.saveData);
    const cpuCores = Number(nav.hardwareConcurrency || 0);
    const deviceMemory = Number(nav.deviceMemory || 0);

    const weakNetwork = effectiveType === 'slow-2g' || effectiveType === '2g';
    const weakCpu = cpuCores > 0 && cpuCores <= 4;
    const weakMemory = deviceMemory > 0 && deviceMemory <= 4;

    if (saveData || weakNetwork || weakCpu || weakMemory) {
        return 'low';
    }

    return 'balanced';
}

const RUNTIME_PROFILE = detectRuntimeProfile();
const RUNTIME_TUNING = {
    low: {
        handTrackingFps: 12,
        audioAnalysisIntervalMs: 100,
        faceDetectionIntervalMs: 450,
        openAiTimeoutMs: 26000
    },
    balanced: {
        handTrackingFps: 20,
        audioAnalysisIntervalMs: 70,
        faceDetectionIntervalMs: 320,
        openAiTimeoutMs: 22000
    }
};
const ACTIVE_RUNTIME_TUNING = RUNTIME_TUNING[RUNTIME_PROFILE] || RUNTIME_TUNING.balanced;
const HAND_TRACKING_INTERVAL_MS = Math.round(1000 / ACTIVE_RUNTIME_TUNING.handTrackingFps);
const AUDIO_ANALYSIS_INTERVAL_MS = ACTIVE_RUNTIME_TUNING.audioAnalysisIntervalMs;
const FACE_DETECTION_INTERVAL_MS = ACTIVE_RUNTIME_TUNING.faceDetectionIntervalMs;
const OPENAI_FETCH_TIMEOUT_MS = ACTIVE_RUNTIME_TUNING.openAiTimeoutMs;
const OPENAI_FETCH_RETRIES = 1;
const OPENAI_FETCH_RETRY_DELAY_MS = 500;
const ODYSSEY_CONNECT_MAX_ATTEMPTS = 2;
const ODYSSEY_CONNECT_RETRY_DELAY_MS = 950;
const REPLAY_LOOP_SECONDS = 10;
const REPLAY_LOOP_WINDOW_MS = REPLAY_LOOP_SECONDS * 1000;
const REPLAY_TIMESLICE_MS = 1000;
const REPLAY_CHUNK_RETENTION_MS = 12000;
const REPLAY_RECORDER_STOP_TIMEOUT_MS = 900;
const REPLAY_RECORDER_MIME_TYPES = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm'
];

const externalScriptPromises = new Map();
let mediaPipeLoadPromise = null;
let faceApiLoadPromise = null;
let faceApiModelsLoadPromise = null;

const DYNAMIC_BG_DEFAULT_PALETTE = [
    { h: 54, s: 92, l: 64 },
    { h: 88, s: 74, l: 58 },
    { h: 32, s: 86, l: 78 }
];
const DYNAMIC_BG_NEUTRAL_PALETTE = [
    { h: 0, s: 0, l: 95 },
    { h: 0, s: 0, l: 95 },
    { h: 0, s: 0, l: 95 }
];
const DYNAMIC_BG_SAMPLE_DIM = 28;
const DYNAMIC_BG_PIXEL_STEP = 2;
const DYNAMIC_BG_HUE_BUCKET_SIZE = 15;
const DYNAMIC_BG_MAX_SAMPLED_CARDS = 8;
const DYNAMIC_BG_MIN_HUE_DISTANCE = 44;
const DYNAMIC_BG_HUE_LOCK_DEGREES = 26;
const DYNAMIC_BG_MIN_UPDATE_INTERVAL_MS = 1300;
const DYNAMIC_BG_REFRESH_INTERVAL_MS = 3600;
const DYNAMIC_BG_INITIAL_BLEND_DELAY_MS = 420;

let dynamicBgRefreshTimeoutId = null;
let dynamicBgRefreshIntervalId = null;
let dynamicBgRefreshInFlight = false;
let dynamicBgLastUpdateAt = 0;
let dynamicBgCurrentPaletteKey = '';
let dynamicBgSamplerCanvas = null;
let dynamicBgSamplerCtx = null;
let dynamicBgLayerAEl = null;
let dynamicBgLayerBEl = null;
let dynamicBgActiveLayerKey = 'a';
let dynamicBgTransitionInitialized = false;
let dynamicBgHasAppliedPalette = false;
let dynamicBgSwapTimeoutId = null;

// ==================== INITIALIZATION ====================

// Loaded from config.public.js and optional local config.js.
// Production should use Supabase Edge Functions for OpenAI so secrets never ship to the browser.
const openaiApiKey = window.OPENAI_API_KEY || '';
const isLocalRuntimeHost = new Set(['localhost', '127.0.0.1', '::1']).has(window.location.hostname);
const wanderApiBase = String(window.WANDER_API_BASE || '').replace(/\/+$/, '');
const configuredOpenAiProxyUrl = String(
    window.WANDER_OPENAI_PROXY_URL ||
    (wanderApiBase ? `${wanderApiBase}/openai-chat` : '')
).trim();
const openaiProxyUrl = isLocalRuntimeHost && openaiApiKey ? '' : configuredOpenAiProxyUrl;
const configuredOdysseyCredentialsUrl = String(
    window.WANDER_ODYSSEY_CREDENTIALS_URL ||
    (wanderApiBase ? `${wanderApiBase}/odyssey-demo-key` : '')
).trim();
const odysseyCredentialsUrl = isLocalRuntimeHost && window.ODYSSEY_API_KEY ? '' : configuredOdysseyCredentialsUrl;
const configuredOdysseyApiKey = window.ODYSSEY_API_KEY || '';
const allowOdysseyKeyPrompt = window.WANDER_ALLOW_ODYSSEY_KEY_PROMPT !== false;
const DEFAULT_PROJECT_TITLE = 'untitled project';
const DEMO_ACCESS_PASSWORD_STORAGE_KEY = 'wander_demo_access_password';
let isEnteringApp = false;
let hasAutoGeneratedProjectTitle = false;
let projectTitleEditedManually = false;
let lastCommittedProjectTitle = DEFAULT_PROJECT_TITLE;
const PROJECTS_STORAGE_KEY = 'wander_projects_v2';
const PROJECTS_ACTIVE_STORAGE_KEY = 'wander_active_project_v2';
const PROJECT_RUNTIME_STORAGE_KEY = 'wander_project_runtime_v1';
const LEGACY_CONCEPTS_STORAGE_KEY = 'wander_concepts_v1';
const MAX_PROJECTS = 32;
let projects = [];
let activeProjectId = null;
const projectRuntimeState = new Map();
const PROJECT_AUTOSAVE_DEBOUNCE_MS = 220;
let projectAutosaveTimeout = null;
let projectAutosaveInFlight = false;
let projectAutosaveQueued = false;
let projectAutosaveNeedsRender = false;

const TITLE_VERSUS_CONNECTORS = new Set([
    'to', 'toward', 'towards', 'against', 'versus', 'vs', 'at'
]);

const TITLE_WITH_CONNECTORS = new Set([
    'with', 'featuring', 'include', 'includes', 'including', 'plus', 'alongside'
]);

const TITLE_CONNECTORS = new Set([
    ...TITLE_VERSUS_CONNECTORS,
    ...TITLE_WITH_CONNECTORS
]);

const TITLE_SKIP_WORDS = new Set([
    'a', 'an', 'the', 'some', 'any', 'many', 'much', 'very',
    'of', 'in', 'on', 'into', 'onto', 'from', 'for', 'by', 'over', 'under',
    'group', 'crowd', 'pack', 'bunch', 'set', 'collection'
]);

const TITLE_ACTION_WORDS = new Set([
    'walking', 'running', 'flying', 'spitting', 'fighting', 'chasing', 'attacking',
    'jumping', 'swimming', 'driving', 'riding', 'moving', 'looking', 'standing',
    'sitting', 'dancing', 'exploring', 'talking', 'laying', 'lying', 'resting'
]);

const TITLE_STYLE_STOP_WORDS = new Set([
    'it', 'has', 'the', 'a', 'an', 'of', 'in', 'on', 'for', 'this', 'that', 'style'
]);

function normalizeProjectTitle(title) {
    return String(title || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 64);
}

function titleCase(value) {
    return String(value || '')
        .split(' ')
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function extractTitleEntity(tokens, startIndex) {
    let index = startIndex;
    while (index < tokens.length && TITLE_SKIP_WORDS.has(tokens[index])) {
        index += 1;
    }

    const parts = [];
    while (index < tokens.length && parts.length < 2) {
        const token = tokens[index];
        if (TITLE_CONNECTORS.has(token) || TITLE_ACTION_WORDS.has(token)) {
            break;
        }
        if (!TITLE_SKIP_WORDS.has(token)) {
            parts.push(token);
        }
        index += 1;
    }

    return parts.join(' ');
}

function extractStylePhrase(cleanedPrompt) {
    if (!cleanedPrompt) return '';

    const styleMatch = cleanedPrompt.match(/(?:in\s+the\s+style\s+of|style\s+of|style)\s+(.+)$/);
    if (!styleMatch) return '';

    const styleSource = styleMatch[1];
    const styleTokens = styleSource
        .split(' ')
        .filter(Boolean)
        .filter((token) => !TITLE_STYLE_STOP_WORDS.has(token));

    if (!styleTokens.length) return '';

    if (styleTokens.includes('indie') && styleTokens.includes('cinema')) {
        return 'Indie Cinema';
    }

    if (styleTokens.includes('indie') && styleTokens.includes('film')) {
        return 'Indie Film';
    }

    const cinemaIndex = styleTokens.findIndex((token) => token === 'cinema' || token === 'film' || token === 'movie');
    if (cinemaIndex >= 0) {
        const prev = cinemaIndex > 0 ? styleTokens[cinemaIndex - 1] : '';
        const phrase = prev ? `${prev} ${styleTokens[cinemaIndex]}` : styleTokens[cinemaIndex];
        return titleCase(phrase);
    }

    return titleCase(styleTokens.slice(0, 2).join(' '));
}

function generateProjectTitleFromPrompt(promptText) {
    const cleaned = String(promptText || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    if (!cleaned) {
        return DEFAULT_PROJECT_TITLE;
    }

    const tokens = cleaned.split(' ').filter(Boolean);
    if (!tokens.length) {
        return DEFAULT_PROJECT_TITLE;
    }

    let subject = extractTitleEntity(tokens, 0);
    if (!subject) {
        subject = tokens.find((token) => !TITLE_SKIP_WORDS.has(token)) || tokens[0];
    }

    let opponent = '';
    for (let i = 0; i < tokens.length; i += 1) {
        if (!TITLE_VERSUS_CONNECTORS.has(tokens[i])) continue;
        const candidate = extractTitleEntity(tokens, i + 1);
        if (!candidate || candidate === subject) continue;
        opponent = candidate;
        break;
    }

    let companion = '';
    if (!opponent) {
        for (let i = 0; i < tokens.length; i += 1) {
            if (!TITLE_WITH_CONNECTORS.has(tokens[i])) continue;
            const candidate = extractTitleEntity(tokens, i + 1);
            if (!candidate || candidate === subject) continue;
            companion = candidate;
            break;
        }
    }

    let title;
    if (subject && opponent && subject !== opponent) {
        title = `${titleCase(subject)} vs ${titleCase(opponent)}`;
    } else if (subject && companion && subject !== companion) {
        title = `${titleCase(subject)} with ${titleCase(companion)}`;
    } else {
        const fallback = tokens
        .filter((token) => !TITLE_SKIP_WORDS.has(token) && !TITLE_ACTION_WORDS.has(token))
        .slice(0, 3)
        .join(' ');
        title = titleCase(subject || fallback || DEFAULT_PROJECT_TITLE);
    }

    const stylePhrase = extractStylePhrase(cleaned);
    if (stylePhrase && !title.toLowerCase().includes(stylePhrase.toLowerCase())) {
        title = `${title}, ${stylePhrase}`;
    }

    return title;
}

function setSidebarStreamStatus(value) {
    if (streamStatus) {
        streamStatus.textContent = value;
    }
}

function setInteractionCountDisplay(value = interactionCount) {
    if (interactionCountEl) {
        interactionCountEl.textContent = String(value);
    }
}

function setGeneratingIndicator(active) {
    if (!generatingIndicator) return;
    generatingIndicator.classList.toggle('active', !!active);
}

function setGestureIndicator(text = '', active = false, hideAfterMs = 0) {
    if (!gestureIndicator) return;
    if (text) {
        gestureIndicator.textContent = text;
    }
    gestureIndicator.classList.toggle('active', !!active);
    if (active && hideAfterMs > 0) {
        setTimeout(() => {
            if (gestureIndicator) {
                gestureIndicator.classList.remove('active');
            }
        }, hideAfterMs);
    }
}

function readMinimalUiModePreference() {
    try {
        const raw = localStorage.getItem(UI_MINIMAL_MODE_STORAGE_KEY);
        if (raw === null) {
            localStorage.setItem(UI_MINIMAL_MODE_STORAGE_KEY, 'true');
            return true;
        }
        return raw !== 'false';
    } catch (_) {
        return true;
    }
}

function readPromptBarVisiblePreference() {
    try {
        const raw = localStorage.getItem(PROMPT_BAR_VISIBLE_STORAGE_KEY);
        if (raw === null) {
            localStorage.setItem(PROMPT_BAR_VISIBLE_STORAGE_KEY, 'true');
            return true;
        }
        return raw !== 'false';
    } catch (_) {
        return true;
    }
}

function setPromptBarVisibility(visible, options = {}) {
    const normalized = !!visible;
    const persist = options.persist !== false;

    isPromptBarVisible = normalized;
    document.body?.classList.toggle('prompt-bar-hidden', !normalized);
    speechPillWrapperEl?.setAttribute('aria-hidden', normalized ? 'false' : 'true');

    if (optionPromptBarToggleEl && optionPromptBarToggleEl.checked !== normalized) {
        optionPromptBarToggleEl.checked = normalized;
    }

    if (!normalized) {
        closeSensesPanel();
    }

    if (persist) {
        try {
            localStorage.setItem(PROMPT_BAR_VISIBLE_STORAGE_KEY, normalized ? 'true' : 'false');
        } catch (_) {
            // no-op
        }
    }
}

function readThemeModePreference() {
    try {
        const raw = String(localStorage.getItem(THEME_MODE_STORAGE_KEY) || '').trim().toLowerCase();
        if (raw === 'dark' || raw === 'light') {
            return raw;
        }
        localStorage.setItem(THEME_MODE_STORAGE_KEY, 'light');
        return 'light';
    } catch (_) {
        return 'light';
    }
}

function setThemeMode(mode, options = {}) {
    const normalized = String(mode || '').toLowerCase() === 'dark' ? 'dark' : 'light';
    const persist = options.persist !== false;

    currentThemeMode = normalized;
    document.body?.classList.toggle('theme-dark', normalized === 'dark');
    document.body?.setAttribute('data-theme', normalized);

    if (optionThemeToggleEl) {
        const shouldBeChecked = normalized === 'dark';
        if (optionThemeToggleEl.checked !== shouldBeChecked) {
            optionThemeToggleEl.checked = shouldBeChecked;
        }
    }

    if (persist) {
        try {
            localStorage.setItem(THEME_MODE_STORAGE_KEY, normalized);
        } catch (_) {
            // no-op
        }
    }
}

function clearInstructionBannerAutoHideTimer() {
    if (instructionBannerAutoHideTimer) {
        clearTimeout(instructionBannerAutoHideTimer);
        instructionBannerAutoHideTimer = null;
    }
}

function setInstructionBannerHidden(hidden, options = {}) {
    if (!instructionBannerEl) return;
    const immediate = !!options.immediate;

    if (hidden) {
        clearInstructionBannerAutoHideTimer();
        instructionBannerEl.classList.add('is-hidden');
        if (immediate) {
            instructionBannerEl.style.display = 'none';
            return;
        }
        setTimeout(() => {
            if (instructionBannerEl.classList.contains('is-hidden')) {
                instructionBannerEl.style.display = 'none';
            }
        }, INSTRUCTION_BANNER_HIDE_TRANSITION_MS);
        return;
    }

    instructionBannerEl.style.display = 'flex';
    requestAnimationFrame(() => {
        instructionBannerEl.classList.remove('is-hidden');
    });
}

function scheduleInstructionBannerAutoHide() {
    if (!instructionBannerEl || !isMinimalUiMode || instructionBannerHiddenForSession) return;
    clearInstructionBannerAutoHideTimer();
    instructionBannerAutoHideTimer = setTimeout(() => {
        instructionBannerAutoHideTimer = null;
        if (instructionBannerHiddenForSession || !isMinimalUiMode) return;
        instructionBannerHiddenForSession = true;
        setInstructionBannerHidden(true);
    }, INSTRUCTION_BANNER_AUTO_HIDE_MS);
}

function markInstructionBannerInteractionComplete() {
    if (!isMinimalUiMode) return;
    instructionBannerHiddenForSession = true;
    setInstructionBannerHidden(true);
}

function hasSeenWelcomeThisSession() {
    try {
        return sessionStorage.getItem(WELCOME_SEEN_SESSION_STORAGE_KEY) === 'true';
    } catch (_) {
        return false;
    }
}

function markWelcomeSeenThisSession() {
    try {
        sessionStorage.setItem(WELCOME_SEEN_SESSION_STORAGE_KEY, 'true');
    } catch (_) {
        // no-op
    }
}

function showWelcomeModal(options = {}) {
    if (!wanderWelcomeModalEl) return;
    const force = options.force === true;
    if (!force && hasSeenWelcomeThisSession()) return;

    wanderWelcomeModalEl.hidden = false;
    document.body?.classList.add('welcome-modal-open');
    if (!force) {
        markWelcomeSeenThisSession();
    }
    setTimeout(() => {
        wanderWelcomeCloseBtn?.focus?.();
    }, 0);
}

function hideWelcomeModal() {
    if (!wanderWelcomeModalEl) return;
    wanderWelcomeModalEl.hidden = true;
    document.body?.classList.remove('welcome-modal-open');
    markWelcomeSeenThisSession();
}

function clampNumber(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function normalizeHueDegrees(value) {
    const raw = Number(value);
    if (!Number.isFinite(raw)) return 0;
    const wrapped = raw % 360;
    return wrapped < 0 ? wrapped + 360 : wrapped;
}

function getHueDistance(a, b) {
    const hueA = normalizeHueDegrees(a);
    const hueB = normalizeHueDegrees(b);
    const direct = Math.abs(hueA - hueB);
    return Math.min(direct, 360 - direct);
}

function getSignedHueDelta(fromHue, toHue) {
    const from = normalizeHueDegrees(fromHue);
    const to = normalizeHueDegrees(toHue);
    return ((to - from + 540) % 360) - 180;
}

function clampHueTowardAnchor(hue, anchorHue, maxDelta = DYNAMIC_BG_HUE_LOCK_DEGREES) {
    const signedDelta = getSignedHueDelta(anchorHue, hue);
    if (Math.abs(signedDelta) <= maxDelta) {
        return normalizeHueDegrees(hue);
    }
    const direction = signedDelta >= 0 ? 1 : -1;
    return normalizeHueDegrees(anchorHue + (direction * maxDelta));
}

function assignLiquidGlassPhase(el) {
    if (!(el instanceof HTMLElement)) return;
    el.style.setProperty('--liquid-rim-delay', `${(-Math.random() * 9).toFixed(2)}s`);
}

function getDynamicBackgroundSamplerContext() {
    if (dynamicBgSamplerCtx) return dynamicBgSamplerCtx;
    dynamicBgSamplerCanvas = document.createElement('canvas');
    dynamicBgSamplerCanvas.width = DYNAMIC_BG_SAMPLE_DIM;
    dynamicBgSamplerCanvas.height = DYNAMIC_BG_SAMPLE_DIM;
    dynamicBgSamplerCtx = dynamicBgSamplerCanvas.getContext('2d', { willReadFrequently: true });
    return dynamicBgSamplerCtx;
}

function rgbToHsl(r, g, b) {
    const red = clampNumber(Number(r) / 255, 0, 1);
    const green = clampNumber(Number(g) / 255, 0, 1);
    const blue = clampNumber(Number(b) / 255, 0, 1);

    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);
    const delta = max - min;
    const light = (max + min) / 2;

    let hue = 0;
    let sat = 0;

    if (delta > 0.0001) {
        sat = delta / (1 - Math.abs((2 * light) - 1));

        if (max === red) {
            hue = ((green - blue) / delta) % 6;
        } else if (max === green) {
            hue = ((blue - red) / delta) + 2;
        } else {
            hue = ((red - green) / delta) + 4;
        }
        hue *= 60;
    }

    return {
        h: normalizeHueDegrees(hue),
        s: clampNumber(sat * 100, 0, 100),
        l: clampNumber(light * 100, 0, 100)
    };
}

function sampleDominantColorFromMediaElement(mediaEl) {
    const samplerCtx = getDynamicBackgroundSamplerContext();
    if (!samplerCtx || !mediaEl) return null;

    let sourceWidth = 0;
    let sourceHeight = 0;

    if (mediaEl instanceof HTMLVideoElement) {
        if (mediaEl.readyState < 2) return null;
        sourceWidth = mediaEl.videoWidth || 0;
        sourceHeight = mediaEl.videoHeight || 0;
    } else if (mediaEl instanceof HTMLImageElement) {
        if (!mediaEl.complete || !mediaEl.naturalWidth || !mediaEl.naturalHeight) return null;
        sourceWidth = mediaEl.naturalWidth;
        sourceHeight = mediaEl.naturalHeight;
    } else {
        return null;
    }

    if (!sourceWidth || !sourceHeight) return null;

    const sampleSize = DYNAMIC_BG_SAMPLE_DIM;
    const bucketMap = new Map();

    try {
        samplerCtx.clearRect(0, 0, sampleSize, sampleSize);
        samplerCtx.drawImage(mediaEl, 0, 0, sourceWidth, sourceHeight, 0, 0, sampleSize, sampleSize);
        const imageData = samplerCtx.getImageData(0, 0, sampleSize, sampleSize);
        const pixels = imageData.data;

        for (let y = 0; y < sampleSize; y += DYNAMIC_BG_PIXEL_STEP) {
            for (let x = 0; x < sampleSize; x += DYNAMIC_BG_PIXEL_STEP) {
                const index = ((y * sampleSize) + x) * 4;
                const alpha = pixels[index + 3];
                if (alpha < 12) continue;

                const red = pixels[index];
                const green = pixels[index + 1];
                const blue = pixels[index + 2];
                const hsl = rgbToHsl(red, green, blue);

                if (hsl.s < 10) continue;
                if (hsl.l < 8 || hsl.l > 95) continue;

                const bucketKey = Math.floor(normalizeHueDegrees(hsl.h) / DYNAMIC_BG_HUE_BUCKET_SIZE);
                let bucket = bucketMap.get(bucketKey);
                if (!bucket) {
                    bucket = {
                        sumX: 0,
                        sumY: 0,
                        sumS: 0,
                        sumL: 0,
                        weight: 0
                    };
                    bucketMap.set(bucketKey, bucket);
                }

                const satWeight = 0.45 + ((hsl.s / 100) * 0.75);
                const lightCenterBias = 1 - (Math.abs(hsl.l - 62) / 62);
                const weight = Math.max(0.08, satWeight * Math.max(0.2, lightCenterBias));
                const hueRadians = hsl.h * (Math.PI / 180);

                bucket.sumX += Math.cos(hueRadians) * weight;
                bucket.sumY += Math.sin(hueRadians) * weight;
                bucket.sumS += hsl.s * weight;
                bucket.sumL += hsl.l * weight;
                bucket.weight += weight;
            }
        }
    } catch (_) {
        return null;
    }

    let bestBucket = null;
    for (const bucket of bucketMap.values()) {
        if (!bestBucket || bucket.weight > bestBucket.weight) {
            bestBucket = bucket;
        }
    }

    if (!bestBucket || bestBucket.weight <= 0) return null;

    const avgHueRadians = Math.atan2(bestBucket.sumY, bestBucket.sumX);
    const hue = normalizeHueDegrees((avgHueRadians * 180) / Math.PI);
    const sat = clampNumber(bestBucket.sumS / bestBucket.weight, 36, 96);
    const light = clampNumber(bestBucket.sumL / bestBucket.weight, 28, 82);

    return {
        h: hue,
        s: sat,
        l: light,
        weight: bestBucket.weight
    };
}

function getCardDominantColorCandidate(cardState) {
    if (!cardState) return null;

    const streamingColor = sampleDominantColorFromMediaElement(cardState.videoEl);
    if (streamingColor) return streamingColor;

    const replayVideoEl = cardState.replayVideoEl || cardState.cardEl?.querySelector('.video-replay-loop');
    if (cardState.replayActive && replayVideoEl) {
        const replayColor = sampleDominantColorFromMediaElement(replayVideoEl);
        if (replayColor) return replayColor;
    }

    const freezeFrameEl = cardState.cardEl?.querySelector('.video-freeze-frame');
    if (freezeFrameEl && cardState.isFrozen && freezeFrameEl.src) {
        const frozenColor = sampleDominantColorFromMediaElement(freezeFrameEl);
        if (frozenColor) return frozenColor;
    }

    return null;
}

/** Collects one dominant color per card from ALL cards; used to build background palette (top 3 by weight + hue diversity). */
function getDynamicBackgroundCandidatesFromCards() {
    const orderedCards = Array.from(streamCards.values())
        .sort((left, right) => {
            const zLeft = Number.parseInt(left?.cardEl?.style?.zIndex || '0', 10) || 0;
            const zRight = Number.parseInt(right?.cardEl?.style?.zIndex || '0', 10) || 0;
            return zRight - zLeft;
        })
        .slice(0, DYNAMIC_BG_MAX_SAMPLED_CARDS);

    const candidates = [];
    for (const cardState of orderedCards) {
        const colorCandidate = getCardDominantColorCandidate(cardState);
        if (colorCandidate) {
            candidates.push(colorCandidate);
        }
    }
    return candidates;
}

function createFallbackPaletteFromSeed(seedColor) {
    const seed = seedColor || DYNAMIC_BG_DEFAULT_PALETTE[0];
    const offsets = [0, -12, 14];
    return offsets.map((offset, index) => ({
        h: normalizeHueDegrees(seed.h + offset),
        s: clampNumber((seed.s * 0.88) + (index === 0 ? 4 : 0), 42, 88),
        l: clampNumber((seed.l * 0.88) + (index === 0 ? 6 : index === 1 ? 2 : 4), 34, 72),
        weight: 1
    }));
}

/** Builds a 3-color palette from candidates (one per card); picks top 3 by weight with hue diversity so all cards contribute. */
function buildDiverseDynamicBackgroundPalette(candidates) {
    const source = Array.isArray(candidates) ? candidates.filter(Boolean) : [];
    if (!source.length) {
        return DYNAMIC_BG_NEUTRAL_PALETTE.map((color) => ({ ...color, weight: 1 }));
    }

    const sorted = source
        .slice()
        .sort((left, right) => (right.weight || 0) - (left.weight || 0));

    const minHueDist = DYNAMIC_BG_MIN_HUE_DISTANCE;
    const selected = [];
    const selectedIndices = new Set();

    for (let i = 0; i < sorted.length && selected.length < 3; i++) {
        const candidate = sorted[i];
        const h = normalizeHueDegrees(candidate.h);
        const isFarEnoughFromAll = selected.every(
            (s) => getHueDistance(h, s.h) >= minHueDist
        );
        if (selected.length === 0 || isFarEnoughFromAll) {
            selected.push({ ...candidate, h });
            selectedIndices.add(i);
        }
    }

    for (let i = 0; i < sorted.length && selected.length < 3; i++) {
        if (selectedIndices.has(i)) continue;
        selected.push({ ...sorted[i], h: normalizeHueDegrees(sorted[i].h) });
    }

    while (selected.length < 3) {
        const anchor = selected[0] || sorted[0];
        const fallback = createFallbackPaletteFromSeed(anchor)[selected.length];
        if (!fallback) break;
        selected.push(fallback);
    }

    const finalPalette = (selected.length >= 3 ? selected : createFallbackPaletteFromSeed(sorted[0]))
        .slice(0, 3)
        .map((color, index) => ({
            h: normalizeHueDegrees(color.h + (index === 1 ? -6 : index === 2 ? 8 : 0)),
            s: clampNumber(color.s + (index === 0 ? 8 : index === 1 ? 4 : 2), 42, 90),
            l: clampNumber(color.l + (index === 0 ? 2 : index === 1 ? 0 : 3), 34, 74),
            weight: color.weight || 1
        }));

    return finalPalette;
}

function dynamicBackgroundColorToCss(color) {
    const hue = Math.round(normalizeHueDegrees(color?.h || 0));
    const sat = Math.round(clampNumber(color?.s || 64, 0, 100));
    const light = Math.round(clampNumber(color?.l || 64, 0, 100));
    return `hsl(${hue} ${sat}% ${light}% / 0.76)`;
}

function setDynamicBackgroundLayerPalette(layerKey, palette) {
    if (!videoArea) return;
    const targetPalette = Array.isArray(palette) && palette.length >= 3
        ? palette
        : DYNAMIC_BG_NEUTRAL_PALETTE;
    const areaStyle = videoArea.style;
    areaStyle.setProperty(`--dynamic-bg-${layerKey}-c1`, dynamicBackgroundColorToCss(targetPalette[0]));
    areaStyle.setProperty(`--dynamic-bg-${layerKey}-c2`, dynamicBackgroundColorToCss(targetPalette[1]));
    areaStyle.setProperty(`--dynamic-bg-${layerKey}-c3`, dynamicBackgroundColorToCss(targetPalette[2]));
}

function ensureDynamicBackgroundLayers() {
    if (!videoArea) return null;

    const hasLayerA = dynamicBgLayerAEl && dynamicBgLayerAEl.isConnected;
    const hasLayerB = dynamicBgLayerBEl && dynamicBgLayerBEl.isConnected;

    if (!hasLayerA || !hasLayerB) {
        dynamicBgLayerAEl = document.createElement('div');
        dynamicBgLayerAEl.className = 'dynamic-bg-layer dynamic-bg-layer--a';

        dynamicBgLayerBEl = document.createElement('div');
        dynamicBgLayerBEl.className = 'dynamic-bg-layer dynamic-bg-layer--b';

        videoArea.insertBefore(dynamicBgLayerAEl, videoArea.firstChild || null);
        videoArea.insertBefore(dynamicBgLayerBEl, videoArea.firstChild || null);
        dynamicBgTransitionInitialized = false;
    }

    if (!dynamicBgTransitionInitialized) {
        setDynamicBackgroundLayerPalette('a', DYNAMIC_BG_NEUTRAL_PALETTE);
        setDynamicBackgroundLayerPalette('b', DYNAMIC_BG_NEUTRAL_PALETTE);
        dynamicBgLayerAEl.classList.add('is-active');
        dynamicBgLayerBEl.classList.remove('is-active');
        dynamicBgActiveLayerKey = 'a';
        dynamicBgTransitionInitialized = true;
        dynamicBgHasAppliedPalette = false;
    }

    return {
        a: dynamicBgLayerAEl,
        b: dynamicBgLayerBEl
    };
}

function applyDynamicBackgroundPalette(palette) {
    if (!Array.isArray(palette) || palette.length < 3) return;
    const key = palette
        .slice(0, 3)
        .map((color) => `${Math.round(color.h)}-${Math.round(color.s)}-${Math.round(color.l)}`)
        .join('|');

    if (key === dynamicBgCurrentPaletteKey) return;

    const layers = ensureDynamicBackgroundLayers();
    if (!layers) return;

    const nextLayerKey = dynamicBgActiveLayerKey === 'a' ? 'b' : 'a';
    const nextLayerEl = nextLayerKey === 'a' ? layers.a : layers.b;
    const currentLayerEl = dynamicBgActiveLayerKey === 'a' ? layers.a : layers.b;
    if (!nextLayerEl || !currentLayerEl) return;

    setDynamicBackgroundLayerPalette(nextLayerKey, palette);

    if (dynamicBgSwapTimeoutId) {
        clearTimeout(dynamicBgSwapTimeoutId);
        dynamicBgSwapTimeoutId = null;
    }

    const shouldDelayInitialBlend = !dynamicBgHasAppliedPalette;
    const blendDelay = shouldDelayInitialBlend ? DYNAMIC_BG_INITIAL_BLEND_DELAY_MS : 0;

    dynamicBgSwapTimeoutId = setTimeout(() => {
        dynamicBgSwapTimeoutId = null;
        requestAnimationFrame(() => {
            nextLayerEl.classList.add('is-active');
            currentLayerEl.classList.remove('is-active');
            dynamicBgActiveLayerKey = nextLayerKey;
            dynamicBgCurrentPaletteKey = key;
            dynamicBgHasAppliedPalette = true;
        });
    }, blendDelay);
}

function refreshDynamicBackgroundFromCards(options = {}) {
    const force = !!options.force;
    const now = Date.now();
    if (!force && (now - dynamicBgLastUpdateAt) < DYNAMIC_BG_MIN_UPDATE_INTERVAL_MS) {
        return;
    }
    if (dynamicBgRefreshInFlight) return;

    dynamicBgRefreshInFlight = true;
    try {
        const candidates = getDynamicBackgroundCandidatesFromCards();
        const palette = buildDiverseDynamicBackgroundPalette(candidates);
        applyDynamicBackgroundPalette(palette);
        dynamicBgLastUpdateAt = now;
    } finally {
        dynamicBgRefreshInFlight = false;
    }
}

function scheduleDynamicBackgroundRefresh(options = {}) {
    const immediate = !!options.immediate;
    const delayMs = Number.isFinite(options.delayMs) ? Math.max(0, options.delayMs) : 0;

    if (dynamicBgRefreshTimeoutId) {
        clearTimeout(dynamicBgRefreshTimeoutId);
        dynamicBgRefreshTimeoutId = null;
    }

    const now = Date.now();
    const throttleWait = immediate
        ? 0
        : Math.max(0, DYNAMIC_BG_MIN_UPDATE_INTERVAL_MS - (now - dynamicBgLastUpdateAt));
    const wait = Math.max(delayMs, throttleWait);

    dynamicBgRefreshTimeoutId = setTimeout(() => {
        dynamicBgRefreshTimeoutId = null;
        refreshDynamicBackgroundFromCards();
    }, wait);
}

function syncDynamicBackgroundRefreshLoop() {
    if (dynamicBgRefreshIntervalId) {
        clearInterval(dynamicBgRefreshIntervalId);
        dynamicBgRefreshIntervalId = null;
    }
    // Background updates only when a new card is generated, not on a timer.
}

let projectSwitchInFlight = false;

function createProjectRecord(titleText = DEFAULT_PROJECT_TITLE) {
    const title = normalizeProjectTitle(titleText) || DEFAULT_PROJECT_TITLE;
    const now = Date.now();
    return {
        id: `project-${now}-${Math.random().toString(36).slice(2, 8)}`,
        title,
        createdAt: now,
        updatedAt: now
    };
}

function normalizeProjectRecord(value) {
    if (!value || typeof value !== 'object') return null;
    const normalized = {
        id: typeof value.id === 'string' && value.id.trim()
            ? value.id.trim()
            : `project-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: normalizeProjectTitle(value.title) || DEFAULT_PROJECT_TITLE,
        createdAt: Number.isFinite(value.createdAt) ? value.createdAt : Date.now(),
        updatedAt: Number.isFinite(value.updatedAt) ? value.updatedAt : Date.now()
    };
    return normalized;
}

function getProjectById(projectId) {
    if (!projectId) return null;
    return projects.find((project) => project.id === projectId) || null;
}

function ensureProjectRecord(projectId, titleText = DEFAULT_PROJECT_TITLE) {
    const normalizedTitle = normalizeProjectTitle(titleText) || DEFAULT_PROJECT_TITLE;
    let target = projectId ? getProjectById(projectId) : null;

    if (!target) {
        const now = Date.now();
        const resolvedId = (typeof projectId === 'string' && projectId.trim())
            ? projectId.trim()
            : `project-${now}-${Math.random().toString(36).slice(2, 8)}`;

        target = {
            id: resolvedId,
            title: normalizedTitle,
            createdAt: now,
            updatedAt: now
        };
        projects.push(target);
    } else {
        target.title = normalizedTitle;
        target.updatedAt = Date.now();
    }

    return target;
}

function persistProjects() {
    try {
        localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects.slice(0, MAX_PROJECTS)));
    } catch (error) {
        console.warn('Failed to persist projects:', error);
    }
}

function persistActiveProjectId() {
    try {
        if (activeProjectId) {
            localStorage.setItem(PROJECTS_ACTIVE_STORAGE_KEY, activeProjectId);
        } else {
            localStorage.removeItem(PROJECTS_ACTIVE_STORAGE_KEY);
        }
    } catch (error) {
        console.warn('Failed to persist active project id:', error);
    }
}

function normalizeRuntimeCardSnapshot(value) {
    if (!value || typeof value !== 'object') return null;
    return {
        left: Number.isFinite(value.left) ? value.left : 0,
        top: Number.isFinite(value.top) ? value.top : 0,
        zIndex: Number.isFinite(value.zIndex) ? value.zIndex : 0,
        statusText: String(value.statusText || 'Stopped'),
        seedPrompt: String(value.seedPrompt || ''),
        lastAppliedPrompt: String(value.lastAppliedPrompt || ''),
        promptDraft: String(value.promptDraft || ''),
        promptChips: Array.isArray(value.promptChips)
            ? value.promptChips.map((chip) => normalizePromptChipSnapshot(chip)).filter(Boolean)
            : [],
        freezeFrameData: typeof value.freezeFrameData === 'string' ? value.freezeFrameData : ''
    };
}

function normalizePromptChipSnapshot(value) {
    if (!value || typeof value !== 'object') return null;
    const type = String(value.type || 'final');
    const source = String(value.source || (type === 'seed' ? 'seed' : 'voice'));
    const text = String(value.text || '').trim();
    const finalPrompt = String(value.finalPrompt || '').trim();
    const hasText = text.length >= CHIP_MIN_TEXT_LENGTH;
    const hasPrompt = finalPrompt.length >= CHIP_MIN_TEXT_LENGTH;
    if (!hasText && !hasPrompt) return null;
    const rawEdge = String(value.position?.edge || '').trim().toLowerCase();
    const edge = rawEdge === 'top' || rawEdge === 'right' || rawEdge === 'bottom' || rawEdge === 'left'
        ? rawEdge
        : null;
    const offset = Number.isFinite(Number(value.position?.offset))
        ? Number(value.position.offset)
        : null;

    return {
        id: typeof value.id === 'string' && value.id.trim()
            ? value.id.trim()
            : `chip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: type === 'seed' || type === 'draft' ? type : 'final',
        source: source || 'voice',
        text: hasText ? text : finalPrompt,
        finalPrompt: hasPrompt ? finalPrompt : text,
        createdAt: Number.isFinite(value.createdAt) ? value.createdAt : Date.now(),
        isCommitted: type === 'draft' ? false : value.isCommitted !== false,
        position: {
            edge,
            offset,
            slotIndex: Number.isFinite(value.position?.slotIndex) ? value.position.slotIndex : null,
            ring: Number.isFinite(value.position?.ring) ? value.position.ring : 0
        }
    };
}

function normalizeProjectRuntimeSnapshot(value) {
    if (!value || typeof value !== 'object') return null;
    return {
        cards: Array.isArray(value.cards)
            ? value.cards.map((entry) => normalizeRuntimeCardSnapshot(entry)).filter(Boolean)
            : [],
        canvasPanX: Number.isFinite(value.canvasPanX) ? value.canvasPanX : 0,
        canvasPanY: Number.isFinite(value.canvasPanY) ? value.canvasPanY : 0,
        nextCardOffset: Number.isFinite(value.nextCardOffset) ? value.nextCardOffset : 0,
        cardZIndex: Number.isFinite(value.cardZIndex) ? value.cardZIndex : 20,
        interactionCount: Number.isFinite(value.interactionCount) ? value.interactionCount : 0,
        currentSceneState: String(value.currentSceneState || ''),
        initialStoryline: String(value.initialStoryline || ''),
        storyContext: Array.isArray(value.storyContext)
            ? value.storyContext.map((entry) => String(entry || '')).filter(Boolean).slice(-10)
            : [],
        draftTitle: normalizeProjectTitle(value.draftTitle) || DEFAULT_PROJECT_TITLE
    };
}

function loadProjectRuntimeState() {
    projectRuntimeState.clear();
    try {
        const raw = localStorage.getItem(PROJECT_RUNTIME_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        if (!parsed || typeof parsed !== 'object') return;

        Object.entries(parsed).forEach(([projectId, runtime]) => {
            if (!projectId) return;
            const normalized = normalizeProjectRuntimeSnapshot(runtime);
            if (normalized) {
                projectRuntimeState.set(projectId, normalized);
            }
        });
    } catch (error) {
        console.warn('Failed to load project runtime state:', error);
    }
}

function persistProjectRuntimeState() {
    try {
        const validProjectIds = new Set(projects.map((project) => project.id));
        const payload = {};

        projectRuntimeState.forEach((runtime, projectId) => {
            if (validProjectIds.size && !validProjectIds.has(projectId)) return;
            const normalized = normalizeProjectRuntimeSnapshot(runtime);
            if (!normalized) return;

            // Keep persisted payload lightweight and reliable for localStorage limits.
            normalized.cards = normalized.cards.map((card) => ({
                ...card,
                freezeFrameData: ''
            }));

            payload[projectId] = normalized;
        });

        localStorage.setItem(PROJECT_RUNTIME_STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
        console.warn('Failed to persist project runtime state:', error);
    }
}

function pruneProjectRuntimeStateToProjects() {
    const validProjectIds = new Set(projects.map((project) => project.id));
    let changed = false;

    Array.from(projectRuntimeState.keys()).forEach((projectId) => {
        if (validProjectIds.has(projectId)) return;
        projectRuntimeState.delete(projectId);
        changed = true;
    });

    if (changed) {
        persistProjectRuntimeState();
    }
}

function getCurrentProjectTitleForSave() {
    const fromInput = normalizeProjectTitle(projectTitleInput?.value || '');
    if (fromInput) return fromInput;
    return normalizeProjectTitle(lastCommittedProjectTitle || '');
}

function updateSaveProjectButtonState() {
    // Manual save is removed; projects are autosaved on every change.
}

function renderConceptCards() {
    if (!conceptsGridEl) return;
    conceptsGridEl.innerHTML = '';

    if (!projects.length) {
        const empty = document.createElement('div');
        empty.className = 'concept-empty';
        empty.textContent = 'No concepts yet';
        conceptsGridEl.appendChild(empty);
        return;
    }

    projects.forEach((project) => {
        const card = document.createElement('article');
        card.className = 'concept-card';
        if (project.id === activeProjectId) {
            card.classList.add('is-active');
        }

        const openBtn = document.createElement('button');
        openBtn.type = 'button';
        openBtn.className = 'concept-card-open';
        openBtn.title = project.title;
        openBtn.textContent = project.title;
        openBtn.addEventListener('click', async () => {
            await activateProject(project.id);
        });

        const meta = document.createElement('div');
        meta.className = 'concept-card-meta';

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'concept-card-delete';
        deleteBtn.title = 'Delete project';
        deleteBtn.textContent = 'x';
        deleteBtn.disabled = projects.length <= 1;
        deleteBtn.addEventListener('click', async (event) => {
            event.stopPropagation();
            if (deleteBtn.disabled) return;
            await deleteProject(project.id);
        });

        meta.appendChild(deleteBtn);
        card.appendChild(openBtn);
        card.appendChild(meta);
        conceptsGridEl.appendChild(card);
    });
}

function loadProjects() {
    let loadedProjects = [];
    try {
        const raw = localStorage.getItem(PROJECTS_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        loadedProjects = Array.isArray(parsed)
            ? parsed
                .map((entry) => normalizeProjectRecord(entry))
                .filter(Boolean)
            : [];
    } catch (error) {
        console.warn('Failed to load projects:', error);
        loadedProjects = [];
    }

    if (!loadedProjects.length) {
        try {
            const rawLegacy = localStorage.getItem(LEGACY_CONCEPTS_STORAGE_KEY);
            const parsedLegacy = rawLegacy ? JSON.parse(rawLegacy) : [];
            if (Array.isArray(parsedLegacy)) {
                loadedProjects = parsedLegacy
                    .map((entry) => normalizeProjectTitle(entry))
                    .filter(Boolean)
                    .map((title) => createProjectRecord(title));
            }
        } catch (_) {
            // no-op
        }
    }

    if (!loadedProjects.length) {
        loadedProjects = [createProjectRecord(DEFAULT_PROJECT_TITLE)];
    }

    projects = loadedProjects.slice(0, MAX_PROJECTS);
    loadProjectRuntimeState();
    pruneProjectRuntimeStateToProjects();

    projects.forEach((project) => {
        const runtime = projectRuntimeState.get(project.id);
        if (!runtime) return;
        const runtimeTitle = normalizeProjectTitle(runtime.draftTitle);
        if (!runtimeTitle) return;
        project.title = runtimeTitle;
    });

    const storedActiveId = localStorage.getItem(PROJECTS_ACTIVE_STORAGE_KEY);
    if (storedActiveId && projects.some((project) => project.id === storedActiveId)) {
        activeProjectId = storedActiveId;
    } else {
        activeProjectId = projects[0].id;
    }

    persistProjects();
    persistActiveProjectId();
    renderConceptCards();

    const activeProject = getProjectById(activeProjectId);
    const activeTitle = normalizeProjectTitle(activeProject?.title) || DEFAULT_PROJECT_TITLE;
    if (projectTitleInput) {
        projectTitleInput.value = activeTitle;
    }
    lastCommittedProjectTitle = activeTitle;

    const isUntitled = activeTitle.toLowerCase() === DEFAULT_PROJECT_TITLE;
    hasAutoGeneratedProjectTitle = !isUntitled;
    projectTitleEditedManually = !isUntitled;
    updateSaveProjectButtonState();
}

function snapshotCardState(cardState) {
    if (!cardState?.cardEl) return null;

    const left = parseFloat(cardState.cardEl.style.left || '0');
    const top = parseFloat(cardState.cardEl.style.top || '0');
    const zIndex = Number.parseInt(cardState.cardEl.style.zIndex || '0', 10) || 0;
    const freezeEl = cardState.cardEl.querySelector('.video-freeze-frame');
    const freezeFrameData = freezeEl?.src && freezeEl.style.display !== 'none'
        ? freezeEl.src
        : '';

    return {
        left: Number.isFinite(left) ? left : 0,
        top: Number.isFinite(top) ? top : 0,
        zIndex,
        statusText: String(cardState.statusEl?.getAttribute('aria-label') || cardState.statusEl?.title || cardState.statusEl?.textContent || 'Frozen'),
        seedPrompt: String(cardState.seedPrompt || ''),
        lastAppliedPrompt: String(cardState.lastAppliedPrompt || ''),
        promptDraft: String(cardState.pendingSpeechDraftText || ''),
        promptChips: Array.isArray(cardState.promptChips)
            ? cardState.promptChips
                .map((chip) => normalizePromptChipSnapshot({
                    id: chip.id,
                    type: chip.type,
                    source: chip.source,
                    text: chip.text,
                    finalPrompt: chip.finalPrompt,
                    createdAt: chip.createdAt,
                    isCommitted: chip.isCommitted,
                    position: chip.position
                }))
                .filter(Boolean)
            : [],
        freezeFrameData
    };
}

async function freezeAndStopAllSecondaryCards() {
    const ids = Array.from(streamCards.keys());
    for (const cardId of ids) {
        const cardState = streamCards.get(cardId);
        if (!cardState) continue;
        if (cardState.isStreaming || cardState.isConnected || cardState.replayActive) {
            await freezeAndStopSecondaryCard(cardId, { trackProjectChange: false });
        }
    }
}

async function captureProjectRuntimeSnapshot(projectId, options = {}) {
    const { freezeStreams = true } = options;
    if (!projectId) return;

    if (freezeStreams) {
        await freezeAndStopAllSecondaryCards();
    }

    const cardSnapshots = [];
    streamCards.forEach((cardState) => {
        const snapshot = snapshotCardState(cardState);
        if (snapshot) {
            cardSnapshots.push(snapshot);
        }
    });

    const draftTitle = getCurrentProjectTitleForSave();
    projectRuntimeState.set(projectId, {
        cards: cardSnapshots,
        canvasPanX,
        canvasPanY,
        nextCardOffset,
        cardZIndex,
        interactionCount,
        currentSceneState,
        initialStoryline,
        storyContext: Array.isArray(storyContext) ? [...storyContext] : [],
        draftTitle
    });

    ensureProjectRecord(projectId, draftTitle);

    persistProjects();
    persistProjectRuntimeState();
}

function cancelScheduledProjectAutosave() {
    if (projectAutosaveTimeout) {
        clearTimeout(projectAutosaveTimeout);
        projectAutosaveTimeout = null;
    }
}

async function autosaveActiveProjectNow(options = {}) {
    const { freezeStreams = false } = options;
    if (!activeProjectId || projectSwitchInFlight) return false;

    if (projectAutosaveInFlight) {
        projectAutosaveQueued = true;
        return false;
    }

    projectAutosaveInFlight = true;
    const shouldRender = projectAutosaveNeedsRender;
    projectAutosaveNeedsRender = false;

    try {
        await captureProjectRuntimeSnapshot(activeProjectId, { freezeStreams });
        if (shouldRender) {
            renderConceptCards();
        }
        return true;
    } finally {
        projectAutosaveInFlight = false;
        if (projectAutosaveQueued) {
            projectAutosaveQueued = false;
            scheduleActiveProjectAutosave();
        }
    }
}

function scheduleActiveProjectAutosave(options = {}) {
    const { render = false } = options;
    if (render) {
        projectAutosaveNeedsRender = true;
    }
    if (!activeProjectId || projectSwitchInFlight) return;

    if (projectAutosaveTimeout) {
        clearTimeout(projectAutosaveTimeout);
    }

    projectAutosaveTimeout = setTimeout(() => {
        projectAutosaveTimeout = null;
        void autosaveActiveProjectNow({ freezeStreams: false });
    }, PROJECT_AUTOSAVE_DEBOUNCE_MS);
}

async function clearAllCanvasCards() {
    const ids = Array.from(streamCards.keys());
    for (const cardId of ids) {
        await stopAndRemoveStreamCard(cardId);
    }
}

function applyRuntimeSessionState(runtime = null) {
    const nextPanX = Number.isFinite(runtime?.canvasPanX) ? runtime.canvasPanX : 0;
    const nextPanY = Number.isFinite(runtime?.canvasPanY) ? runtime.canvasPanY : 0;
    canvasPanX = nextPanX;
    canvasPanY = nextPanY;
    applyCanvasPan();

    nextCardOffset = Number.isFinite(runtime?.nextCardOffset) ? runtime.nextCardOffset : 0;
    cardZIndex = Math.max(20, Number.isFinite(runtime?.cardZIndex) ? runtime.cardZIndex : 20);
    interactionCount = Number.isFinite(runtime?.interactionCount) ? runtime.interactionCount : 0;
    setInteractionCountDisplay(interactionCount);

    currentSceneState = typeof runtime?.currentSceneState === 'string' ? runtime.currentSceneState : '';
    initialStoryline = typeof runtime?.initialStoryline === 'string' ? runtime.initialStoryline : '';
    storyContext = Array.isArray(runtime?.storyContext)
        ? runtime.storyContext.map((entry) => String(entry || '')).filter(Boolean).slice(-10)
        : [];

    hoverPointerCardId = null;
    lastClickTargetCardId = null;
    mouseHoverCardId = null;
    dotHoverCardId = null;
    setActiveStream(null, null);
    hideGlobalHandCursor();
    hideAllVoicePromptPanels();
    hideCanvasVoicePrompt();
    syncDynamicBackgroundRefreshLoop();
}

async function restoreProjectRuntimeSnapshot(projectId) {
    const runtime = projectRuntimeState.get(projectId);
    applyRuntimeSessionState(runtime || null);

    const snapshots = Array.isArray(runtime?.cards)
        ? [...runtime.cards].sort((a, b) => (a?.zIndex || 0) - (b?.zIndex || 0))
        : [];

    for (const snapshot of snapshots) {
        createStreamCardFromSnapshot(snapshot);
    }

    syncDynamicBackgroundRefreshLoop();
}

function isProjectUntitled(titleText) {
    return normalizeProjectTitle(titleText).toLowerCase() === DEFAULT_PROJECT_TITLE;
}

function isProjectUnused(projectId) {
    const project = getProjectById(projectId);
    if (!project) return false;

    const runtime = projectRuntimeState.get(projectId);
    const runtimeCards = Array.isArray(runtime?.cards) ? runtime.cards.length : 0;
    const effectiveTitle = normalizeProjectTitle(runtime?.draftTitle || project.title || DEFAULT_PROJECT_TITLE);

    return runtimeCards === 0 && isProjectUntitled(effectiveTitle);
}

async function activateProject(projectId, options = {}) {
    const { skipCapture = false } = options;
    const targetProject = getProjectById(projectId);
    if (!targetProject) return false;
    if (promptSpawnInFlight) return false;
    if (projectSwitchInFlight) return false;
    if (activeProjectId === projectId && !skipCapture) {
        renderConceptCards();
        updateSaveProjectButtonState();
        return true;
    }

    projectSwitchInFlight = true;
    try {
        recordStreamTelemetry('project_switch_start', { projectId });
        cancelScheduledProjectAutosave();
        projectAutosaveQueued = false;
        projectAutosaveNeedsRender = false;

        const previousProjectId = activeProjectId;
        if (previousProjectId && !skipCapture) {
            await captureProjectRuntimeSnapshot(previousProjectId);
        }

        await clearAllCanvasCards();

        activeProjectId = projectId;
        persistActiveProjectId();
        await restoreProjectRuntimeSnapshot(projectId);

        const runtime = projectRuntimeState.get(projectId);
        const nextTitle = normalizeProjectTitle(runtime?.draftTitle || targetProject.title) || DEFAULT_PROJECT_TITLE;
        if (projectTitleInput) {
            projectTitleInput.value = nextTitle;
        }
        lastCommittedProjectTitle = nextTitle;

        const isUntitled = nextTitle.toLowerCase() === DEFAULT_PROJECT_TITLE;
        hasAutoGeneratedProjectTitle = !isUntitled;
        projectTitleEditedManually = !isUntitled;

        renderConceptCards();
        updateSaveProjectButtonState();
        recordStreamTelemetry('project_switch_success', { projectId });
        return true;
    } finally {
        projectSwitchInFlight = false;
    }
}

async function createAndActivateNewProject() {
    if (promptSpawnInFlight || projectSwitchInFlight) return;

    cancelScheduledProjectAutosave();
    projectAutosaveQueued = false;
    projectAutosaveNeedsRender = false;

    let previousProjectId = activeProjectId;
    if (!previousProjectId) {
        const seededProject = ensureProjectRecord(null, getCurrentProjectTitleForSave());
        previousProjectId = seededProject.id;
        activeProjectId = seededProject.id;
        persistActiveProjectId();
    } else {
        ensureProjectRecord(previousProjectId, getCurrentProjectTitleForSave());
    }

    let shouldDropPreviousEmptyUntitled = false;
    if (previousProjectId && getProjectById(previousProjectId)) {
        await captureProjectRuntimeSnapshot(previousProjectId);
        shouldDropPreviousEmptyUntitled = isProjectUnused(previousProjectId);
    }

    if (shouldDropPreviousEmptyUntitled && previousProjectId) {
        projectRuntimeState.delete(previousProjectId);
        projects = projects.filter((project) => project.id !== previousProjectId);
        if (activeProjectId === previousProjectId) {
            activeProjectId = null;
        }
    }

    const newProject = createProjectRecord(DEFAULT_PROJECT_TITLE);
    projects.unshift(newProject);

    if (projects.length > MAX_PROJECTS) {
        const removed = projects.splice(MAX_PROJECTS);
        removed.forEach((entry) => projectRuntimeState.delete(entry.id));
    }

    persistProjects();
    persistProjectRuntimeState();
    renderConceptCards();
    await activateProject(newProject.id, { skipCapture: true });
}

async function deleteProject(projectId) {
    const targetIndex = projects.findIndex((project) => project.id === projectId);
    if (targetIndex < 0) return false;

    const deletingActiveProject = activeProjectId === projectId;
    const nextFallbackIndex = Math.min(targetIndex, Math.max(0, projects.length - 2));
    projectRuntimeState.delete(projectId);
    projects.splice(targetIndex, 1);

    if (!projects.length) {
        projects = [createProjectRecord(DEFAULT_PROJECT_TITLE)];
    }

    persistProjects();
    persistProjectRuntimeState();

    if (deletingActiveProject) {
        const fallbackProject = projects[nextFallbackIndex] || projects[0];
        activeProjectId = null;
        await activateProject(fallbackProject.id, { skipCapture: true });
    } else {
        renderConceptCards();
        updateSaveProjectButtonState();
    }

    return true;
}

function setupProjectTitleInput() {
    if (!projectTitleInput) return;

    const initial = normalizeProjectTitle(projectTitleInput.value);
    const normalizedInitial = initial || DEFAULT_PROJECT_TITLE;
    projectTitleInput.value = normalizedInitial;
    lastCommittedProjectTitle = normalizedInitial;

    projectTitleInput.addEventListener('focus', () => {
        try {
            projectTitleInput.select();
        } catch (_) {
            // no-op
        }
    });

    projectTitleInput.addEventListener('input', () => {
        projectTitleEditedManually = true;
        hasAutoGeneratedProjectTitle = true;
        updateSaveProjectButtonState();
        scheduleActiveProjectAutosave({ render: true });
    });

    projectTitleInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            projectTitleInput.blur();
            return;
        }

        if (event.key === 'Escape') {
            event.preventDefault();
            projectTitleInput.value = lastCommittedProjectTitle;
            projectTitleInput.blur();
        }
    });

    projectTitleInput.addEventListener('blur', () => {
        const nextTitle = normalizeProjectTitle(projectTitleInput.value) || lastCommittedProjectTitle || DEFAULT_PROJECT_TITLE;
        projectTitleInput.value = nextTitle;
        lastCommittedProjectTitle = nextTitle;
        updateSaveProjectButtonState();
        scheduleActiveProjectAutosave({ render: true });
    });

    updateSaveProjectButtonState();
}

function maybeAutoSetProjectTitleFromPrompt(promptText) {
    if (!projectTitleInput) return;
    if (hasAutoGeneratedProjectTitle || projectTitleEditedManually) return;

    const current = normalizeProjectTitle(projectTitleInput.value);
    if (current && current.toLowerCase() !== DEFAULT_PROJECT_TITLE) {
        hasAutoGeneratedProjectTitle = true;
        return;
    }

    const autoTitle = normalizeProjectTitle(generateProjectTitleFromPrompt(promptText));
    if (!autoTitle) return;

    projectTitleInput.value = autoTitle;
    lastCommittedProjectTitle = autoTitle;
    hasAutoGeneratedProjectTitle = true;

    const activeProject = getProjectById(activeProjectId);
    if (activeProject) {
        activeProject.title = autoTitle;
        activeProject.updatedAt = Date.now();
    }

    if (activeProjectId) {
        const runtime = projectRuntimeState.get(activeProjectId);
        if (runtime) {
            runtime.draftTitle = autoTitle;
            projectRuntimeState.set(activeProjectId, runtime);
        } else {
            const initializedRuntime = normalizeProjectRuntimeSnapshot({ draftTitle: autoTitle });
            if (initializedRuntime) {
                projectRuntimeState.set(activeProjectId, initializedRuntime);
            }
        }
    }

    persistProjects();
    persistProjectRuntimeState();
    renderConceptCards();

    updateSaveProjectButtonState();
}

function getOdysseyApiKey() {
    if (odysseyCredentialsUrl) {
        return configuredOdysseyApiKey.trim();
    }
    const savedKey = localStorage.getItem('odyssey_api_key') || '';
    return (savedKey || configuredOdysseyApiKey).trim();
}

function getDemoAccessPassword() {
    try {
        return String(sessionStorage.getItem(DEMO_ACCESS_PASSWORD_STORAGE_KEY) || '').trim();
    } catch (_) {
        return '';
    }
}

function persistDemoAccessPassword(password) {
    const normalizedPassword = String(password || '').trim();
    if (!normalizedPassword) return '';
    try {
        sessionStorage.setItem(DEMO_ACCESS_PASSWORD_STORAGE_KEY, normalizedPassword);
    } catch (_) {
        // If sessionStorage is blocked, keep the password only in the active input.
    }
    return normalizedPassword;
}

function buildOdysseyStartOptions(prompt, options = {}) {
    return {
        prompt,
        ...options
    };
}

function persistOdysseyApiKey(apiKey) {
    const normalizedKey = String(apiKey || '').trim();
    if (!normalizedKey) return '';

    localStorage.setItem('odyssey_api_key', normalizedKey);
    return normalizedKey;
}

function setOdysseyKeyGateError(message = '') {
    if (odysseyKeyGateErrorEl) {
        odysseyKeyGateErrorEl.textContent = message;
    }
}

function showOdysseyKeyGate(message = '') {
    if (!allowOdysseyKeyPrompt || !odysseyKeyGateEl) return;

    setOdysseyKeyGateError(message);
    odysseyKeyGateEl.hidden = false;
    requestAnimationFrame(() => {
        odysseyKeyInputEl?.focus();
    });
}

function hideOdysseyKeyGate() {
    if (odysseyKeyGateEl) {
        odysseyKeyGateEl.hidden = true;
    }
    setOdysseyKeyGateError('');
}

function requestOdysseyApiKeyFromUser() {
    showOdysseyKeyGate(odysseyCredentialsUrl ? 'Enter the demo password to start streaming.' : 'Enter an Odyssey API key to start streaming.');
    return '';
}

function hasOdysseyCredentialsAccess() {
    return Boolean(odysseyCredentialsUrl && getDemoAccessPassword());
}

function hasOdysseyConnectionAccess() {
    return Boolean(getOdysseyApiKey() || hasOdysseyCredentialsAccess());
}

async function validateOdysseyDemoPassword(password) {
    if (!odysseyCredentialsUrl) return true;
    recordStreamTelemetry('demo_password_validate_start');

    const response = await fetch(odysseyCredentialsUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            password,
            validateOnly: true
        })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const message = data?.error || `Demo access failed (${response.status})`;
        recordStreamTelemetry('demo_password_validate_error', { status: response.status, message });
        throw new Error(message);
    }

    recordStreamTelemetry('demo_password_validate_success', { status: response.status });
    return true;
}

async function fetchOdysseyClientCredentials() {
    if (!odysseyCredentialsUrl) return null;

    const password = getDemoAccessPassword();
    if (!password) {
        requestOdysseyApiKeyFromUser();
        throw new Error('Enter the demo password to connect.');
    }

    recordStreamTelemetry('odyssey_credentials_request_start');
    const response = await fetch(odysseyCredentialsUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        if (response.status === 401) {
            try {
                sessionStorage.removeItem(DEMO_ACCESS_PASSWORD_STORAGE_KEY);
            } catch (_) {
                // no-op
            }
            showOdysseyKeyGate('Demo password expired or was rejected. Enter it again.');
        }
        const message = data?.error || `Credential request failed (${response.status})`;
        recordStreamTelemetry('odyssey_credentials_request_error', { status: response.status, message });
        throw new Error(message);
    }

    const credentialsPayload = data?.credentials || data;
    if (!credentialsPayload?.session_token && !credentialsPayload?.sessionToken) {
        throw new Error('Demo backend did not return Odyssey client credentials.');
    }

    if (typeof window.OdysseyCredentialsFromDict !== 'function') {
        throw new Error('Odyssey credentials helper is unavailable.');
    }

    recordStreamTelemetry('odyssey_credentials_request_success', {
        expiresIn: Number(credentialsPayload.expires_in || credentialsPayload.expiresIn || 0),
        imageToVideo: Boolean(credentialsPayload.capabilities?.image_to_video)
    });
    return window.OdysseyCredentialsFromDict(credentialsPayload);
}

function setupOdysseyKeyGate() {
    if (!odysseyKeyGateEl || !odysseyKeyInputEl || !odysseyKeyStartBtn) return;

    const startWithEnteredKey = async () => {
        const enteredValue = String(odysseyKeyInputEl.value || '').trim();
        if (!enteredValue) {
            setOdysseyKeyGateError(odysseyCredentialsUrl ? 'Enter the demo password first.' : 'Paste a valid Odyssey API key first.');
            odysseyKeyInputEl.focus();
            return;
        }

        if (odysseyCredentialsUrl) {
            await validateOdysseyDemoPassword(enteredValue);
            persistDemoAccessPassword(enteredValue);
        } else {
            const apiKey = persistOdysseyApiKey(enteredValue);
            if (!apiKey) {
                setOdysseyKeyGateError('Paste a valid Odyssey API key first.');
                odysseyKeyInputEl.focus();
                return;
            }
        }

        hideOdysseyKeyGate();
        await launchFromLandingScreen();
    };

    odysseyKeyStartBtn.addEventListener('click', () => {
        startWithEnteredKey().catch((error) => {
            console.error('Failed to start with Odyssey key:', error);
            showOdysseyKeyGate(error?.message || 'Failed to start. Check the key and try again.');
        });
    });

    odysseyKeyInputEl.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        startWithEnteredKey().catch((error) => {
            console.error('Failed to start with Odyssey key:', error);
            showOdysseyKeyGate(error?.message || 'Failed to start. Check the key and try again.');
        });
    });
}

function loadExternalScript(src, crossOrigin = null) {
    if (externalScriptPromises.has(src)) {
        return externalScriptPromises.get(src);
    }

    const promise = new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[data-ext-src="${src}"]`);
        if (existing) {
            if (existing.dataset.loaded === 'true') {
                resolve();
                return;
            }

            existing.addEventListener('load', () => resolve(), { once: true });
            existing.addEventListener('error', () => reject(new Error(`Failed to load script: ${src}`)), { once: true });
            return;
        }

        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.dataset.extSrc = src;
        if (crossOrigin) {
            script.crossOrigin = crossOrigin;
        }
        script.addEventListener('load', () => {
            script.dataset.loaded = 'true';
            resolve();
        }, { once: true });
        script.addEventListener('error', () => {
            reject(new Error(`Failed to load script: ${src}`));
        }, { once: true });
        document.head.appendChild(script);
    });

    externalScriptPromises.set(src, promise);
    return promise;
}

async function ensureMediaPipeReady() {
    if (window.Hands && window.drawConnectors && window.drawLandmarks) {
        return;
    }

    if (!mediaPipeLoadPromise) {
        mediaPipeLoadPromise = (async () => {
            for (const src of MEDIA_PIPE_SCRIPT_URLS) {
                await loadExternalScript(src, 'anonymous');
            }
            if (!(window.Hands && window.drawConnectors && window.drawLandmarks)) {
                throw new Error('MediaPipe scripts did not initialize correctly');
            }
        })();
    }

    try {
        await mediaPipeLoadPromise;
    } catch (error) {
        mediaPipeLoadPromise = null;
        throw error;
    }
}

async function ensureFaceApiReady() {
    if (window.faceApiLoaded && window.faceapi) {
        return;
    }

    if (!faceApiLoadPromise) {
        faceApiLoadPromise = (async () => {
            if (!window.faceapi) {
                await loadExternalScript(FACE_API_SCRIPT_URL, 'anonymous');
            }

            if (!faceApiModelsLoadPromise) {
                faceApiModelsLoadPromise = (async () => {
                    await faceapi.nets.tinyFaceDetector.loadFromUri(FACE_API_MODEL_URL);
                    await faceapi.nets.faceExpressionNet.loadFromUri(FACE_API_MODEL_URL);
                    window.faceApiLoaded = true;
                })();
            }

            await faceApiModelsLoadPromise;
        })();
    }

    try {
        await faceApiLoadPromise;
    } catch (error) {
        faceApiLoadPromise = null;
        faceApiModelsLoadPromise = null;
        window.faceApiLoaded = false;
        throw error;
    }
}

function wait(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

function explainMediaAccessError(error, source = 'media') {
    const name = String(error?.name || 'Error');
    const message = String(error?.message || error || 'Unknown media error');
    const hasGetUserMedia = !!navigator.mediaDevices?.getUserMedia;
    console.warn(`[${source}] ${name}: ${message}`);
    console.warn(`[${source}] context`, {
        secureContext: window.isSecureContext,
        hasGetUserMedia,
        origin: window.location.origin
    });

    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        console.warn(`[${source}] Camera/microphone permission is blocked. In Chrome: lock icon -> Site settings -> set Camera and Microphone to Allow, then reload.`);
    } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        console.warn(`[${source}] No camera or microphone device was found by the browser.`);
    } else if (name === 'NotReadableError') {
        console.warn(`[${source}] Device is already in use by another app/tab.`);
    } else if (name === 'NotSupportedError') {
        console.warn(`[${source}] getUserMedia is unavailable in this context. Use HTTPS or localhost.`);
    }
}

function isAbortError(error) {
    return Boolean(error) && (
        error.name === 'AbortError' ||
        String(error.message || '').toLowerCase().includes('aborted')
    );
}

function isRetriableHttpStatus(status) {
    return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

function hasOpenAiTransport() {
    return Boolean(openaiProxyUrl || openaiApiKey);
}

async function requestOpenAiChatCompletions(payload, options = {}) {
    if (!hasOpenAiTransport()) {
        throw new Error('Missing OpenAI transport. Configure WANDER_OPENAI_PROXY_URL or a local OPENAI_API_KEY.');
    }

    const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : OPENAI_FETCH_TIMEOUT_MS;
    const retries = Number.isFinite(options.retries) ? options.retries : OPENAI_FETCH_RETRIES;
    const retryDelayMs = Number.isFinite(options.retryDelayMs) ? options.retryDelayMs : OPENAI_FETCH_RETRY_DELAY_MS;
    const externalSignal = options.signal || null;
    const useProxy = Boolean(openaiProxyUrl);
    const requestUrl = useProxy ? openaiProxyUrl : 'https://api.openai.com/v1/chat/completions';

    let lastError = null;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(new DOMException('OpenAI request timeout', 'AbortError')), timeoutMs);

        let detachExternalAbort = null;
        if (externalSignal) {
            if (externalSignal.aborted) {
                clearTimeout(timeoutId);
                throw new DOMException('OpenAI request aborted', 'AbortError');
            }
            const onAbort = () => controller.abort(new DOMException('OpenAI request aborted', 'AbortError'));
            externalSignal.addEventListener('abort', onAbort, { once: true });
            detachExternalAbort = () => externalSignal.removeEventListener('abort', onAbort);
        }

        try {
            const headers = {
                'Content-Type': 'application/json'
            };
            if (!useProxy) {
                headers.Authorization = `Bearer ${openaiApiKey}`;
            }

            const response = await fetch(requestUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload),
                signal: controller.signal
            });

            if (!response.ok) {
                const detail = await response.text().catch(() => '');
                const error = new Error(`OpenAI API error: ${response.status}${detail ? ` ${detail.slice(0, 180)}` : ''}`);
                error.status = response.status;
                throw error;
            }

            return await response.json();
        } catch (error) {
            lastError = error;

            const abortError = isAbortError(error);
            const timeoutAbort = abortError && String(error?.message || '').toLowerCase().includes('timeout');
            if (externalSignal?.aborted || (abortError && !timeoutAbort)) {
                throw error;
            }

            const status = Number(error?.status || 0);
            const canRetry = attempt < retries && (timeoutAbort || !status || isRetriableHttpStatus(status));
            if (canRetry) {
                await wait(retryDelayMs * (attempt + 1));
                continue;
            }

            throw error;
        } finally {
            clearTimeout(timeoutId);
            detachExternalAbort?.();
        }
    }

    throw lastError || new Error('OpenAI request failed');
}

async function warmMediaDeviceStreams(options = {}) {
    const {
        needMic = true,
        needCamera = true
    } = options;

    if (mediaWarmupInFlight) {
        return mediaWarmupInFlight;
    }

    mediaWarmupInFlight = (async () => {
        const tasks = [];
        const warmupErrors = [];

        if (needMic && !hasLiveAudioTrack(window.microphoneStream)) {
            tasks.push(
                requestMicrophoneStream()
                    .then((stream) => {
                        window.microphoneStream = stream;
                    })
                    .catch((error) => {
                        warmupErrors.push(error);
                        explainMediaAccessError(error, 'microphone warmup');
                    })
            );
        }

        if (needCamera && !hasLiveVideoTrack(window.cameraStream)) {
            tasks.push(
                requestCameraStream()
                    .then((stream) => {
                        window.cameraStream = stream;
                    })
                    .catch((error) => {
                        warmupErrors.push(error);
                        explainMediaAccessError(error, 'camera warmup');
                    })
            );
        }

        if (!tasks.length) return;
        await Promise.allSettled(tasks);

        if (!hasRequiredMediaStreamsReady({ needMic, needCamera })) {
            const unavailable = [];
            if (needMic && !hasLiveAudioTrack(window.microphoneStream)) {
                unavailable.push('microphone');
            }
            if (needCamera && !hasLiveVideoTrack(window.cameraStream)) {
                unavailable.push('camera');
            }
            const summary = unavailable.join(' and ');
            const error = new Error(`Required media stream unavailable: ${summary}`);
            error.name = 'MediaWarmupError';
            error.cause = warmupErrors[0] || null;
            throw error;
        }
    })();

    try {
        await mediaWarmupInFlight;
    } finally {
        mediaWarmupInFlight = null;
    }
}

async function requestMicrophoneStream() {
    if (!navigator.mediaDevices?.getUserMedia) {
        const err = new Error('MediaDevices.getUserMedia is unavailable.');
        err.name = 'NotSupportedError';
        explainMediaAccessError(err, 'microphone');
        throw err;
    }

    try {
        return await navigator.mediaDevices.getUserMedia({ audio: AUDIO_STREAM_CONSTRAINTS });
    } catch (error) {
        console.warn('Microphone constraints fallback:', error.message);
        try {
            return await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (fallbackError) {
            explainMediaAccessError(fallbackError, 'microphone');
            throw fallbackError;
        }
    }
}

async function requestCameraStream() {
    if (!navigator.mediaDevices?.getUserMedia) {
        const err = new Error('MediaDevices.getUserMedia is unavailable.');
        err.name = 'NotSupportedError';
        explainMediaAccessError(err, 'camera');
        throw err;
    }

    try {
        return await navigator.mediaDevices.getUserMedia({ video: VIDEO_STREAM_CONSTRAINTS });
    } catch (error) {
        console.warn('Camera constraints fallback:', error.message);
        try {
            return await navigator.mediaDevices.getUserMedia({ video: true });
        } catch (fallbackError) {
            explainMediaAccessError(fallbackError, 'camera');
            throw fallbackError;
        }
    }
}

function hasLiveVideoTrack(stream) {
    if (!stream) return false;
    const tracks = stream.getVideoTracks?.() || [];
    return tracks.some((track) => track.readyState === 'live');
}

function hasLiveAudioTrack(stream) {
    if (!stream) return false;
    const tracks = stream.getAudioTracks?.() || [];
    return tracks.some((track) => track.readyState === 'live');
}

function hasRequiredMediaStreamsReady(options = {}) {
    const needMic = !!options.needMic;
    const needCamera = !!options.needCamera;
    const micReady = !needMic || hasLiveAudioTrack(window.microphoneStream);
    const cameraReady = !needCamera || hasLiveVideoTrack(window.cameraStream);
    return micReady && cameraReady;
}

function isHandVideoFrameReady() {
    if (!handVideo) return false;
    const width = Number(handVideo.videoWidth || 0);
    const height = Number(handVideo.videoHeight || 0);
    if (handVideo.readyState < 2) return false;
    if (width < HAND_VIDEO_MIN_DIMENSION_PX || height < HAND_VIDEO_MIN_DIMENSION_PX) return false;
    const sourceStream = handVideo.srcObject || window.cameraStream;
    return hasLiveVideoTrack(sourceStream);
}

function isHandTrackingFatalError(error) {
    const message = String(error?.message || error || '').toLowerCase();
    return (
        message.includes('roi->width > 0') ||
        message.includes('roi width and height must be > 0') ||
        message.includes('graph has errors') ||
        message.includes('adding to input_frames_gpu was not ok') ||
        message.includes('teximage2d') ||
        message.includes('no video') ||
        message.includes('waituntilidle') ||
        message.includes('abort')
    );
}

function stopHandTrackingLoop() {
    if (camera) {
        camera.stop();
        camera = null;
    }
    if (handTrackingAnimationFrame) {
        cancelAnimationFrame(handTrackingAnimationFrame);
        handTrackingAnimationFrame = null;
    }
    handInferenceInFlight = false;
}

async function closeHandsRuntime() {
    if (!hands) return;
    const runtime = hands;
    hands = null;
    try {
        await runtime.close();
    } catch (_) {
        // no-op
    }
}

function scheduleHandTrackerRecovery(error) {
    const now = Date.now();
    if (handTrackerRecovering) return;
    if (now - lastHandTrackerFatalAt < HAND_TRACKER_FATAL_RESTART_COOLDOWN_MS) return;
    lastHandTrackerFatalAt = now;
    handTrackerRecovering = true;

    console.warn('Hand tracking runtime reset:', error?.message || error);
    stopHandTrackingLoop();
    clearPointingGestureState();
    endPinchDrag();
    handMissedFrames = 0;
    lastPinchDistanceSample = Infinity;
    setGestureIndicator('', false);

    closeHandsRuntime().finally(async () => {
        if (!handGestureEnabled || !isSenseRuntimeActive()) {
            handTrackerRecovering = false;
            return;
        }

        await wait(240);

        try {
            await ensureCameraFeedReady();
        } catch (cameraError) {
            debugLog('Hand tracker recovery camera warmup failed:', cameraError?.message || cameraError);
        }

        handTrackerRecovering = false;
        startHandGestureTracking().catch((restartError) => {
            console.warn('Hand tracking recovery restart failed:', restartError?.message || restartError);
        });
    });
}

async function ensureCameraFeedReady() {
    if (!hasLiveVideoTrack(window.cameraStream)) {
        if (window.cameraStream) {
            try {
                const oldTracks = window.cameraStream.getTracks?.() || [];
                oldTracks.forEach((track) => track.stop());
            } catch (_) {
                // no-op
            }
        }
        window.cameraStream = await requestCameraStream();
    }
    if (!window.cameraStream) {
        throw new Error('No camera stream available');
    }

    if (handVideo.srcObject !== window.cameraStream) {
        handVideo.srcObject = window.cameraStream;
    }

    handVideo.autoplay = true;
    handVideo.playsInline = true;
    handVideo.muted = true;
    handVideo.setAttribute('muted', '');

    if (handVideo.readyState < 2 || handVideo.videoWidth === 0) {
        await new Promise((resolve) => {
            let settled = false;
            const finish = () => {
                if (settled) return;
                settled = true;
                resolve();
            };

            handVideo.addEventListener('loadedmetadata', finish, { once: true });
            handVideo.addEventListener('canplay', finish, { once: true });
            setTimeout(finish, 2000);
        });
    }

    try {
        await handVideo.play();
    } catch (_) {
        // ignore autoplay errors; frame readiness is validated below
    }

    if (handVideo.videoWidth === 0 || handVideo.videoHeight === 0) {
        // One extra recovery attempt when camera is granted but feed is stale.
        try {
            const staleTracks = window.cameraStream.getTracks?.() || [];
            staleTracks.forEach((track) => track.stop());
        } catch (_) {
            // no-op
        }
        window.cameraStream = await requestCameraStream();
        handVideo.srcObject = window.cameraStream;
        await new Promise((resolve) => setTimeout(resolve, 250));
        try {
            await handVideo.play();
        } catch (_) {
            // no-op
        }
    }

    if (handVideo.videoWidth === 0 || handVideo.videoHeight === 0) {
        throw new Error('Camera video feed not ready');
    }

    return handVideo;
}

function markCardInteraction(cardId, timestamp = Date.now()) {
    const cardState = cardId ? streamCards.get(cardId) : null;
    if (!cardState) return;
    cardState.lastInteractedAt = Number.isFinite(timestamp) ? timestamp : Date.now();
}

function setActiveStream(type = null, cardId = null) {
    activeStreamType = type;
    activeStreamCardId = cardId;
    if (type === 'secondary' && cardId) {
        markCardInteraction(cardId);
    }
    syncStreamCardHighlightState();
}

function getInteractionContext(preferredCardId = null) {
    const toCardContext = (cardId, cardState) => ({
        cardId,
        displayEl: cardState?.displayEl || null,
        videoEl: cardState?.videoEl || null,
        fingerCursorEl: cardState?.fingerCursorEl || null,
        clickMarkerEl: cardState?.clickMarkerEl || null
    });

    if (preferredCardId && streamCards.has(preferredCardId)) {
        return toCardContext(preferredCardId, streamCards.get(preferredCardId));
    }

    if (activeStreamType === 'secondary' && activeStreamCardId && streamCards.has(activeStreamCardId)) {
        return toCardContext(activeStreamCardId, streamCards.get(activeStreamCardId));
    }

    for (const [cardId, cardState] of streamCards.entries()) {
        if (cardState?.isStreaming || cardState?.isConnected) {
            return toCardContext(cardId, cardState);
        }
    }

    return {
        cardId: null,
        displayEl: null,
        videoEl: null,
        fingerCursorEl: null,
        clickMarkerEl: null
    };
}

function getCardIdAtViewportPoint(clientX, clientY, includeCardChrome = false) {
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;
    if (typeof document.elementsFromPoint !== 'function') return null;

    const stack = document.elementsFromPoint(clientX, clientY);
    if (!Array.isArray(stack) || !stack.length) return null;

    for (const entry of stack) {
        if (!(entry instanceof HTMLElement)) continue;

        let cardEl = null;
        if (includeCardChrome) {
            cardEl = entry.closest('.video-card.is-secondary');
        } else {
            const displayEl = entry.closest('.video-card.is-secondary .video-display');
            cardEl = displayEl ? displayEl.closest('.video-card.is-secondary') : null;
        }

        if (!cardEl) continue;
        const cardId = cardEl.dataset.cardId;
        if (!cardId || !streamCards.has(cardId)) continue;
        return cardId;
    }

    return null;
}

function getCardChipRevealReason(cardId, cardState) {
    if (!cardId || !cardState) return null;
    if (cardState.isPromptSubmitting || cardState.pendingSpeechChipId) {
        return 'speaking';
    }
    if (hoverPointerCardId === cardId || dotHoverCardId === cardId) {
        return 'pointing';
    }
    if (mouseHoverCardId === cardId) {
        return 'hover';
    }
    return null;
}

function updateCardChipRevealState(cardState, reason = null) {
    if (!cardState?.cardEl) return;
    const nextReason = reason || null;
    const nextActive = !!nextReason;
    const changed =
        cardState.isChipRevealActive !== nextActive ||
        cardState.chipRevealReason !== nextReason;

    cardState.isChipRevealActive = nextActive;
    cardState.chipRevealReason = nextReason;
    cardState.cardEl.classList.toggle('is-chips-visible', nextActive);
    if (changed && nextActive) {
        scheduleCardChipLayout(cardState, { force: true });
    }
}

function refreshCardChipRevealState(cardState) {
    if (!cardState) return;
    updateCardChipRevealState(
        cardState,
        getCardChipRevealReason(cardState.id, cardState)
    );
}

function syncAllCardChipRevealStates() {
    streamCards.forEach((cardState) => {
        refreshCardChipRevealState(cardState);
    });
}

function syncStreamCardHighlightState() {
    const promptTargetId = getPromptTargetCardId();
    streamCards.forEach((cardState, cardId) => {
        const cardEl = cardState?.cardEl;
        if (!cardEl) return;

        const isHovered = mouseHoverCardId === cardId || dotHoverCardId === cardId;
        const isSelected = activeStreamType === 'secondary' && activeStreamCardId === cardId;
        const isPromptTarget = promptTargetId === cardId;

        cardEl.classList.toggle('is-hovered', isHovered);
        cardEl.classList.toggle('is-selected', isSelected);
        cardEl.classList.toggle('is-prompt-target', isPromptTarget);
    });
    syncAllCardChipRevealStates();
}

function setMouseHoverCard(cardId = null) {
    if (mouseHoverCardId === cardId) return;
    mouseHoverCardId = cardId;
    syncStreamCardHighlightState();
}

function setDotHoverCard(cardId = null) {
    const changed = dotHoverCardId !== cardId;
    dotHoverCardId = cardId;
    if (cardId && streamCards.has(cardId)) {
        if (activeStreamType !== 'secondary' || activeStreamCardId !== cardId) {
            setActiveStream('secondary', cardId);
            return;
        }
    }
    if (changed) {
        syncStreamCardHighlightState();
    }
}

function ensureGlobalHandCursor() {
    if (globalHandCursorEl && globalHandCursorEl.isConnected) {
        return globalHandCursorEl;
    }

    const host = videoSection || document.body;
    if (!host) return null;

    globalHandCursorEl = document.createElement('div');
    globalHandCursorEl.className = 'finger-cursor global-hand-cursor';
    host.appendChild(globalHandCursorEl);
    return globalHandCursorEl;
}

function showGlobalHandCursor(clientX, clientY, mode = 'neutral') {
    const cursorEl = ensureGlobalHandCursor();
    if (!cursorEl) return;

    setCursorVisualMode(cursorEl, mode);
    cursorEl.style.left = `${clientX}px`;
    cursorEl.style.top = `${clientY}px`;
    cursorEl.classList.add('active');
    cursorEl.classList.remove('clicked');
}

function hideGlobalHandCursor() {
    if (!globalHandCursorEl) return;
    globalHandCursorEl.classList.remove('active');
    globalHandCursorEl.classList.remove('clicked');
    globalHandCursorEl.classList.remove('mode-neutral');
    globalHandCursorEl.classList.remove('mode-pointing');
    globalHandCursorEl.classList.remove('mode-pinching');
}

function getViewportPointFromLandmark(landmark) {
    return {
        x: Math.max(0, Math.min(window.innerWidth, (1.0 - landmark.x) * window.innerWidth)),
        y: Math.max(0, Math.min(window.innerHeight, landmark.y * window.innerHeight))
    };
}

function getPinchDistance(landmarks) {
    const thumbTip = landmarks?.[4];
    const indexTip = landmarks?.[8];
    if (!thumbTip || !indexTip) return Infinity;

    const dx = thumbTip.x - indexTip.x;
    const dy = thumbTip.y - indexTip.y;
    return Math.sqrt((dx * dx) + (dy * dy));
}

function getLandmarkDistance(a, b) {
    if (!a || !b) return Infinity;
    const dx = (a.x || 0) - (b.x || 0);
    const dy = (a.y || 0) - (b.y || 0);
    return Math.sqrt((dx * dx) + (dy * dy));
}

function isGrabPose(landmarks) {
    if (!Array.isArray(landmarks) || landmarks.length < 21) return false;

    const isFingerCurled = (tipIdx, pipIdx, mcpIdx) => {
        const tip = landmarks[tipIdx];
        const pip = landmarks[pipIdx];
        const mcp = landmarks[mcpIdx];
        if (!tip || !pip || !mcp) return false;

        const yCurled = tip.y > pip.y - 0.002;
        const clearlyExtended = (tip.y + 0.01 < pip.y) && (pip.y + 0.004 < mcp.y);
        const mcpToTip = getLandmarkDistance(tip, mcp);
        const mcpToPip = getLandmarkDistance(pip, mcp);
        const compressed = Number.isFinite(mcpToTip) && Number.isFinite(mcpToPip) && mcpToTip < (mcpToPip * 1.12);

        return yCurled && (!clearlyExtended || compressed);
    };

    const indexCurled = isFingerCurled(8, 6, 5);
    const middleCurled = isFingerCurled(12, 10, 9);
    const ringCurled = isFingerCurled(16, 14, 13);
    const pinkyCurled = isFingerCurled(20, 18, 17);

    if (!(indexCurled && middleCurled && ringCurled && pinkyCurled)) {
        return false;
    }

    const thumbTip = landmarks[4];
    const indexMcp = landmarks[5];
    const pinkyMcp = landmarks[17];
    const thumbToIndexMcp = getLandmarkDistance(thumbTip, indexMcp);
    const thumbToPinkyMcp = getLandmarkDistance(thumbTip, pinkyMcp);
    const thumbTucked =
        (Number.isFinite(thumbToIndexMcp) && thumbToIndexMcp < 0.16) ||
        (Number.isFinite(thumbToPinkyMcp) && thumbToPinkyMcp < 0.24);

    const pinchDistance = getPinchDistance(landmarks);
    const notPinchPriority = pinchDistance > (PINCH_START_DISTANCE * 1.05);
    return thumbTucked && notPinchPriority;
}

function getGrabAnchorViewportPoint(landmarks) {
    if (!Array.isArray(landmarks) || landmarks.length < 21) return null;
    const anchorIndexes = [0, 5, 9, 13, 17];
    let sumX = 0;
    let sumY = 0;
    let count = 0;

    for (const index of anchorIndexes) {
        const point = landmarks[index];
        if (!point) continue;
        sumX += point.x;
        sumY += point.y;
        count += 1;
    }

    if (!count) return null;
    return getViewportPointFromLandmark({
        x: sumX / count,
        y: sumY / count
    });
}

function resetPinchAimState() {
    pinchAimOffset = null;
    pinchAimFilteredViewport = null;
}

function resetHandCursorMotionState() {
    handCursorMotionState.active = false;
    handCursorMotionState.mode = 'neutral';
    handCursorMotionState.vx = 0;
    handCursorMotionState.vy = 0;
    handCursorMotionState.lastTs = 0;
}

function getCursorMotionParams(mode = 'neutral') {
    if (mode === 'pinching') {
        return {
            baseAlpha: 0.3,
            fastAlpha: 0.9,
            jitterDeadzonePx: 1.6,
            velocitySmoothing: 0.46,
            predictionMs: 10
        };
    }

    if (mode === 'pointing') {
        return {
            baseAlpha: 0.2,
            fastAlpha: 0.82,
            jitterDeadzonePx: 2.5,
            velocitySmoothing: 0.38,
            predictionMs: 12
        };
    }

    return {
        baseAlpha: 0.24,
        fastAlpha: 0.78,
        jitterDeadzonePx: 2.0,
        velocitySmoothing: 0.4,
        predictionMs: 10
    };
}

function getSmoothedHandCursorPoint(rawX, rawY, mode = 'neutral') {
    const now = performance.now();
    const state = handCursorMotionState;
    const stale = !state.lastTs || (now - state.lastTs) > CURSOR_STATE_TIMEOUT_MS;
    const modeChanged = state.mode !== mode;

    if (!state.active || stale || modeChanged) {
        state.active = true;
        state.mode = mode;
        state.x = rawX;
        state.y = rawY;
        state.rawX = rawX;
        state.rawY = rawY;
        state.vx = 0;
        state.vy = 0;
        state.lastTs = now;
        return { x: rawX, y: rawY };
    }

    const dt = Math.max(8, Math.min(80, now - state.lastTs));
    state.lastTs = now;

    const rawVx = (rawX - state.rawX) / dt;
    const rawVy = (rawY - state.rawY) / dt;
    state.rawX = rawX;
    state.rawY = rawY;

    const params = getCursorMotionParams(mode);
    state.vx += (rawVx - state.vx) * params.velocitySmoothing;
    state.vy += (rawVy - state.vy) * params.velocitySmoothing;

    const distanceToRaw = Math.hypot(rawX - state.x, rawY - state.y);
    const speed = Math.hypot(rawVx, rawVy);
    const speedNorm = Math.max(0, Math.min(1, speed / CURSOR_FAST_SPEED_PX_PER_MS));

    let alpha = params.baseAlpha + (params.fastAlpha - params.baseAlpha) * speedNorm;
    if (distanceToRaw <= params.jitterDeadzonePx && speedNorm < 0.24) {
        alpha *= 0.28;
    }

    let targetX = rawX + state.vx * params.predictionMs;
    let targetY = rawY + state.vy * params.predictionMs;
    const leadX = targetX - rawX;
    const leadY = targetY - rawY;
    const leadMagnitude = Math.hypot(leadX, leadY);
    if (leadMagnitude > CURSOR_PREDICT_LEAD_MAX_PX) {
        const scale = CURSOR_PREDICT_LEAD_MAX_PX / leadMagnitude;
        targetX = rawX + (leadX * scale);
        targetY = rawY + (leadY * scale);
    }

    state.x += (targetX - state.x) * alpha;
    state.y += (targetY - state.y) * alpha;

    state.x = Math.max(0, Math.min(window.innerWidth, state.x));
    state.y = Math.max(0, Math.min(window.innerHeight, state.y));
    return { x: state.x, y: state.y };
}

function getProjectedIndexAimViewportPoint(landmarks) {
    const indexTip = landmarks?.[8];
    const indexPip = landmarks?.[6];
    const indexMcp = landmarks?.[5];
    if (!indexTip || !indexPip || !indexMcp) {
        return indexTip ? getViewportPointFromLandmark(indexTip) : null;
    }

    const projectedX = indexPip.x + (indexPip.x - indexMcp.x) * PINCH_INDEX_PROJECTION;
    const projectedY = indexPip.y + (indexPip.y - indexMcp.y) * PINCH_INDEX_PROJECTION;
    const blendedNormPoint = {
        x: (indexTip.x * (1 - PINCH_AIM_PROJECT_BLEND)) + (projectedX * PINCH_AIM_PROJECT_BLEND),
        y: (indexTip.y * (1 - PINCH_AIM_PROJECT_BLEND)) + (projectedY * PINCH_AIM_PROJECT_BLEND)
    };

    return getViewportPointFromLandmark(blendedNormPoint);
}

function getStabilizedPinchViewportPoint(landmarks) {
    const thumbTip = landmarks?.[4];
    const indexTip = landmarks?.[8];
    if (!thumbTip || !indexTip) return null;

    const thumbPoint = getViewportPointFromLandmark(thumbTip);
    const indexPoint = getViewportPointFromLandmark(indexTip);
    const pinchMidX = (thumbPoint.x + indexPoint.x) * 0.5;
    const pinchMidY = (thumbPoint.y + indexPoint.y) * 0.5;
    const now = Date.now();

    if (!pinchAimOffset) {
        const hasRecentPointAim = !!lastPointAimViewport && (now - lastPointAimTimestamp) <= PINCH_AIM_RECENT_POINTING_MS;
        const referenceAimPoint = hasRecentPointAim
            ? lastPointAimViewport
            : (getProjectedIndexAimViewportPoint(landmarks) || indexPoint);

        let offsetX = referenceAimPoint.x - pinchMidX;
        let offsetY = referenceAimPoint.y - pinchMidY;
        const offsetMagnitude = Math.hypot(offsetX, offsetY);
        if (offsetMagnitude > PINCH_AIM_MAX_OFFSET_PX) {
            const scale = PINCH_AIM_MAX_OFFSET_PX / offsetMagnitude;
            offsetX *= scale;
            offsetY *= scale;
        }

        pinchAimOffset = { x: offsetX, y: offsetY };
        pinchAimFilteredViewport = { x: referenceAimPoint.x, y: referenceAimPoint.y };
    }

    const targetX = pinchMidX + pinchAimOffset.x;
    const targetY = pinchMidY + pinchAimOffset.y;
    if (!pinchAimFilteredViewport) {
        pinchAimFilteredViewport = { x: targetX, y: targetY };
    } else {
        pinchAimFilteredViewport.x += (targetX - pinchAimFilteredViewport.x) * PINCH_AIM_FILTER;
        pinchAimFilteredViewport.y += (targetY - pinchAimFilteredViewport.y) * PINCH_AIM_FILTER;
    }

    return {
        x: Math.max(0, Math.min(window.innerWidth, pinchAimFilteredViewport.x)),
        y: Math.max(0, Math.min(window.innerHeight, pinchAimFilteredViewport.y))
    };
}

function renderHandPresenceCursorAtViewport(clientX, clientY, mode = 'neutral') {
    const smoothedPoint = getSmoothedHandCursorPoint(clientX, clientY, mode);
    const smoothedX = smoothedPoint.x;
    const smoothedY = smoothedPoint.y;
    const target = resolveCursorTargetFromViewport(smoothedX, smoothedY);
    if (!target) {
        setDotHoverCard(null);
        hideInactiveFingerCursors(null);
        showGlobalHandCursor(smoothedX, smoothedY, mode);
        return;
    }

    hideGlobalHandCursor();
    setDotHoverCard(target.hoveredCardId || null);
    if (target.hoveredCardId) {
        hoverPointerCardId = target.hoveredCardId;
        onPointedAtCard();
    }

    fingerCursorPos.x = target.localX;
    fingerCursorPos.y = target.localY;

    const activeCursorEl = target.context.fingerCursorEl;
    activeCursorEl?.classList.remove('clicked');
    updateFingerCursor(target.context, false, mode);
}

function resolveCursorTargetFromViewport(clientX, clientY) {
    const hoveredCardId = getCardIdAtViewportPoint(clientX, clientY, true);
    if (!hoveredCardId) {
        return null;
    }
    const context = getInteractionContext(hoveredCardId);
    if (!context?.displayEl) {
        return null;
    }

    const rect = context.displayEl.getBoundingClientRect();
    if (!rect.width || !rect.height) {
        return null;
    }

    const localX = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const localY = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));

    return {
        hoveredCardId,
        context,
        localX,
        localY
    };
}

function setCursorVisualMode(cursorEl, mode = 'neutral') {
    if (!cursorEl) return;
    cursorEl.classList.remove('mode-neutral');
    cursorEl.classList.remove('mode-pointing');
    cursorEl.classList.remove('mode-pinching');

    if (mode === 'pointing') {
        cursorEl.classList.add('mode-pointing');
    } else if (mode === 'pinching') {
        cursorEl.classList.add('mode-pinching');
    } else {
        cursorEl.classList.add('mode-neutral');
    }
}

function renderHandPresenceCursorFromLandmarks(landmarks, mode = 'neutral') {
    const indexTip = landmarks?.[8];
    if (!indexTip) return;

    const viewportPoint = getViewportPointFromLandmark(indexTip);
    renderHandPresenceCursorAtViewport(viewportPoint.x, viewportPoint.y, mode);
}

function clearPointingGestureState(options = {}) {
    const keepCursor = !!options.keepCursor;
    isPointing = false;
    hoverPointerCardId = null;
    if (!keepCursor) {
        setDotHoverCard(null);
        hideFingerCursor();
        resetHandCursorMotionState();
    }
    const shouldKeepCanvasPrompt =
        isSpeaking &&
        (emptyCanvasVoicePromptState.eligible || isCanvasVoiceCaptureContextActive());
    if (!shouldKeepCanvasPrompt) {
        hideCanvasVoicePrompt();
    }
}

function beginPinchDrag(clientX, clientY, dragType = 'pinch') {
    const cardId = getCardIdAtViewportPoint(clientX, clientY, true);
    if (!cardId) return false;

    const cardState = streamCards.get(cardId);
    if (!cardState?.cardEl) return false;

    bringCardToFront(cardState.cardEl);

    const rect = cardState.cardEl.getBoundingClientRect();

    pinchDragState = {
        cardId,
        dragType,
        filteredClientX: clientX,
        filteredClientY: clientY,
        grabOffsetX: clientX - rect.left,
        grabOffsetY: clientY - rect.top
    };
    pinchReleaseFrames = 0;
    grabReleaseFrames = 0;
    onPinchedToMove();

    cardState.cardEl.classList.add('dragging');
    setActiveStream('secondary', cardId);
    setGestureIndicator(dragType === 'grab' ? 'Grab Drag' : 'Pinch Drag', true);
    return true;
}

function updatePinchDrag(clientX, clientY) {
    if (!pinchDragState) return;

    const cardState = streamCards.get(pinchDragState.cardId);
    if (!cardState?.cardEl) {
        pinchDragState = null;
        return;
    }

    const rawDx = clientX - pinchDragState.filteredClientX;
    const rawDy = clientY - pinchDragState.filteredClientY;
    const rawDistance = Math.hypot(rawDx, rawDy);
    const smoothing = rawDistance >= PINCH_FAST_DELTA_PX ? PINCH_SMOOTHING_FAST : PINCH_SMOOTHING_BASE;

    pinchDragState.filteredClientX += rawDx * smoothing;
    pinchDragState.filteredClientY += rawDy * smoothing;

    const desiredLeft = pinchDragState.filteredClientX - pinchDragState.grabOffsetX - canvasPanX;
    const desiredTop = pinchDragState.filteredClientY - pinchDragState.grabOffsetY - canvasPanY;
    const currentLeft = parseFloat(cardState.cardEl.style.left || '0');
    const currentTop = parseFloat(cardState.cardEl.style.top || '0');
    const stableLeft = Number.isFinite(currentLeft) ? currentLeft : desiredLeft;
    const stableTop = Number.isFinite(currentTop) ? currentTop : desiredTop;

    const deltaLeft = desiredLeft - stableLeft;
    const deltaTop = desiredTop - stableTop;
    const catchupDistance = Math.hypot(deltaLeft, deltaTop);
    const lerp = catchupDistance >= PINCH_CATCHUP_DISTANCE_PX ? PINCH_POSITION_LERP_FAST : PINCH_POSITION_LERP_BASE;

    let nextLeft = stableLeft + deltaLeft * lerp;
    let nextTop = stableTop + deltaTop * lerp;

    if (Math.abs(desiredLeft - stableLeft) <= PINCH_POSITION_DEADZONE_PX) {
        nextLeft = desiredLeft;
    }
    if (Math.abs(desiredTop - stableTop) <= PINCH_POSITION_DEADZONE_PX) {
        nextTop = desiredTop;
    }
    if (catchupDistance >= PINCH_SNAP_DISTANCE_PX) {
        nextLeft = desiredLeft;
        nextTop = desiredTop;
    }

    positionCard(cardState.cardEl, nextLeft, nextTop);
    setGestureIndicator(pinchDragState.dragType === 'grab' ? 'Grab Drag' : 'Pinch Drag', true);
}

function endPinchDrag() {
    if (!pinchDragState) {
        pinchDetectedFrames = 0;
        pinchReleaseFrames = 0;
        grabDetectedFrames = 0;
        grabReleaseFrames = 0;
        resetPinchAimState();
        lastPinchDistanceSample = Infinity;
        return;
    }

    const cardState = streamCards.get(pinchDragState.cardId);
    if (cardState?.cardEl) {
        cardState.cardEl.classList.remove('dragging');
    }

    pinchDragState = null;
    pinchDetectedFrames = 0;
    pinchReleaseFrames = 0;
    grabDetectedFrames = 0;
    grabReleaseFrames = 0;
    resetPinchAimState();
    lastPinchDistanceSample = Infinity;
    scheduleActiveProjectAutosave();
    if ((gestureIndicator?.textContent || '').includes('Drag')) {
        setGestureIndicator('', false);
    }
}

function clearPanelHideTimer(panelEl) {
    const timerId = panelHideTimers.get(panelEl);
    if (timerId) {
        clearTimeout(timerId);
    }
    panelHideTimers.delete(panelEl);
}

function showFloatingPanel(panelEl, openClassName = 'is-visible') {
    if (!panelEl) return;
    clearPanelHideTimer(panelEl);
    panelEl.style.display = 'block';
    panelEl.classList.remove('is-exiting');
    requestAnimationFrame(() => {
        if (!panelEl.isConnected) return;
        panelEl.classList.add(openClassName);
    });
}

function hideFloatingPanel(panelEl, openClassName = 'is-visible') {
    if (!panelEl) return;
    clearPanelHideTimer(panelEl);
    panelEl.classList.remove(openClassName);
    panelEl.classList.add('is-exiting');

    const timerId = setTimeout(() => {
        if (!panelEl.classList.contains(openClassName)) {
            panelEl.style.display = 'none';
            panelEl.classList.remove('is-exiting');
        }
        panelHideTimers.delete(panelEl);
    }, PANEL_VISIBILITY_TRANSITION_MS);

    panelHideTimers.set(panelEl, timerId);
}

function hideAllVoicePromptPanels() {
    // Legacy voice prompt overlays removed. Kept as a no-op for compatibility.
}

function ensureCanvasVoicePromptEl() {
    if (canvasVoicePromptEl && canvasVoicePromptEl.isConnected) {
        return canvasVoicePromptEl;
    }
    if (!videoCanvas) return null;

    canvasVoicePromptEl = document.createElement('div');
    canvasVoicePromptEl.className = 'canvas-voice-prompt-dock liquid-glass liquid-glass--wobble';
    canvasVoicePromptEl.innerHTML = `
        <div class="liquid-glass__rim" aria-hidden="true"></div>
        <div class="canvas-voice-prompt-text">Speak to create...</div>
    `;
    assignLiquidGlassPhase(canvasVoicePromptEl);
    videoCanvas.appendChild(canvasVoicePromptEl);
    return canvasVoicePromptEl;
}

function isViewportPointEligibleForCanvasVoicePrompt(clientX, clientY) {
    if (!videoArea) return false;
    const rect = videoArea.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
        return false;
    }

    const hitEl = document.elementFromPoint(clientX, clientY);
    if (!hitEl) return false;
    if (hitEl.closest(NON_CANVAS_POINTER_SELECTOR)) return false;
    if (hitEl.closest('.video-card')) return false;
    return true;
}

function showCanvasVoicePromptAtViewport(clientX, clientY) {
    const dockEl = ensureCanvasVoicePromptEl();
    if (!dockEl || emptyCanvasVoicePromptState.locked) return;

    emptyCanvasVoicePromptState.canvasX = clientX - canvasPanX;
    emptyCanvasVoicePromptState.canvasY = clientY - canvasPanY;
    emptyCanvasVoicePromptState.visible = true;
    if (!emptyCanvasVoicePromptState.text) {
        emptyCanvasVoicePromptState.text = 'Speak to create...';
    }

    dockEl.style.left = `${emptyCanvasVoicePromptState.canvasX}px`;
    dockEl.style.top = `${emptyCanvasVoicePromptState.canvasY}px`;
    dockEl.classList.add('active');

    const textEl = dockEl.querySelector('.canvas-voice-prompt-text');
    if (textEl) {
        textEl.textContent = emptyCanvasVoicePromptState.text;
    }
}

function showCanvasVoicePromptAtTrackedPoint() {
    const viewportX = emptyCanvasVoicePromptState.canvasX + canvasPanX;
    const viewportY = emptyCanvasVoicePromptState.canvasY + canvasPanY;
    if (!Number.isFinite(viewportX) || !Number.isFinite(viewportY)) {
        return;
    }
    showCanvasVoicePromptAtViewport(viewportX, viewportY);
}

function updateCanvasVoicePromptText(text, options = {}) {
    const dockEl = ensureCanvasVoicePromptEl();
    if (!dockEl) return;

    const normalized = String(text || '').trim();
    const requestedMode = options.mode === 'speech' ? 'speech' : (options.mode === 'idle' ? 'idle' : emptyCanvasVoicePromptState.textMode);
    emptyCanvasVoicePromptState.textMode = normalized ? requestedMode : 'idle';
    emptyCanvasVoicePromptState.text = normalized || 'Speak to create...';
    const textEl = dockEl.querySelector('.canvas-voice-prompt-text');
    if (textEl) {
        textEl.textContent = emptyCanvasVoicePromptState.text;
    }
}

function updateCanvasVoicePromptTracking(clientX, clientY, isEligible) {
    if (!isEligible) {
        hideCanvasVoicePrompt();
        return;
    }

    const now = Date.now();
    emptyCanvasVoicePromptState.eligible = true;
    emptyCanvasVoicePromptState.canvasX = clientX - canvasPanX;
    emptyCanvasVoicePromptState.canvasY = clientY - canvasPanY;

    if (!canvasVoicePromptEligibleSince) {
        canvasVoicePromptEligibleSince = now;
    }

    const hasSpeechText =
        emptyCanvasVoicePromptState.textMode === 'speech' &&
        String(emptyCanvasVoicePromptState.text || '').trim().length > 0;
    const idleDelayReached = (now - canvasVoicePromptEligibleSince) >= CANVAS_VOICE_IDLE_HINT_DELAY_MS;

    if (hasSpeechText) {
        showCanvasVoicePromptAtViewport(clientX, clientY);
        return;
    }

    if (idleDelayReached) {
        updateCanvasVoicePromptText('Speak to create...', { mode: 'idle' });
        showCanvasVoicePromptAtViewport(clientX, clientY);
        return;
    }

    hideCanvasVoicePrompt({ keepText: false, keepEligibility: true });
}

function isCanvasVoicePromptListeningContext() {
    return emptyCanvasVoicePromptState.eligible && !emptyCanvasVoicePromptState.locked;
}

function getRecentPointingCanvasVoiceSpawnPoint() {
    if (emptyCanvasVoicePromptState.locked) return null;
    if (!Number.isFinite(lastPointAimViewport?.x) || !Number.isFinite(lastPointAimViewport?.y)) return null;

    const now = Date.now();
    if ((now - lastPointAimTimestamp) > RECENT_POINTING_VOICE_CONTEXT_MS) return null;

    const viewportX = Number(lastPointAimViewport.x);
    const viewportY = Number(lastPointAimViewport.y);
    if (!isViewportPointEligibleForCanvasVoicePrompt(viewportX, viewportY)) return null;
    if (getCardIdAtViewportPoint(viewportX, viewportY, true)) return null;

    return {
        viewportX,
        viewportY,
        canvasX: viewportX - canvasPanX,
        canvasY: viewportY - canvasPanY
    };
}

function seedCanvasVoicePromptTrackingFromRecentPointing() {
    const fallback = getRecentPointingCanvasVoiceSpawnPoint();
    if (!fallback) return null;

    emptyCanvasVoicePromptState.eligible = true;
    emptyCanvasVoicePromptState.canvasX = fallback.canvasX;
    emptyCanvasVoicePromptState.canvasY = fallback.canvasY;
    if (!canvasVoicePromptEligibleSince) {
        canvasVoicePromptEligibleSince = Date.now();
    }
    return fallback;
}

function isCanvasVoiceCaptureContextActive() {
    if (isCanvasVoicePromptListeningContext()) return true;
    return !!getRecentPointingCanvasVoiceSpawnPoint();
}

function hideCanvasVoicePrompt(options = {}) {
    const keepText = !!options.keepText;
    const keepEligibility = !!options.keepEligibility;
    if (canvasVoicePromptEl) {
        canvasVoicePromptEl.classList.remove('active');
    }

    emptyCanvasVoicePromptState.visible = false;
    emptyCanvasVoicePromptState.locked = false;
    if (!keepEligibility) {
        emptyCanvasVoicePromptState.eligible = false;
        canvasVoicePromptEligibleSince = 0;
    }
    if (!keepText) {
        emptyCanvasVoicePromptState.text = '';
        emptyCanvasVoicePromptState.textMode = 'idle';
    }
}

function hideInactiveFingerCursors(activeCursorEl = null) {
    const hideCursor = (cursorEl) => {
        if (!cursorEl || cursorEl === activeCursorEl) return;
        cursorEl.classList.remove('active');
        cursorEl.classList.remove('clicked');
        cursorEl.classList.remove('mode-neutral');
        cursorEl.classList.remove('mode-pointing');
        cursorEl.classList.remove('mode-pinching');
    };

    hideCursor(fingerCursorEl);
    streamCards.forEach((cardState) => hideCursor(cardState?.fingerCursorEl));
}

function attachDisplayClickHandler(displayEl, cardId = null) {
    if (!displayEl || displayEl.dataset.pointerClickReady === 'true') return;
    displayEl.dataset.pointerClickReady = 'true';

    displayEl.addEventListener('click', (event) => {
        const context = getInteractionContext(cardId);
        if (!context.displayEl) return;

        if (cardId) {
            markCardInteraction(cardId);
            setActiveStream('secondary', cardId);
        }

        const rect = context.displayEl.getBoundingClientRect();
        if (!rect.width || !rect.height) return;

        const xNorm = (event.clientX - rect.left) / rect.width;
        const yNorm = (event.clientY - rect.top) / rect.height;

        console.log('Mouse click at', xNorm.toFixed(2), yNorm.toFixed(2));
        handleFingerClick(xNorm, yNorm, context);
    });
}

function attachCardHoverHandlers(cardEl, cardId) {
    if (!cardEl || !cardId || cardEl.dataset.hoverReady === 'true') return;
    cardEl.dataset.hoverReady = 'true';

    const updateMouseAim = (event) => {
        const context = getInteractionContext(cardId);
        const displayEl = context?.displayEl;
        if (!displayEl) return;
        const rect = displayEl.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const xNorm = (event.clientX - rect.left) / rect.width;
        const yNorm = (event.clientY - rect.top) / rect.height;
        updateCardVoiceAim(cardId, xNorm, yNorm, 'mouse');
    };

    cardEl.addEventListener('pointerenter', (event) => {
        if (event.pointerType === 'touch') return;
        setMouseHoverCard(cardId);
        updateMouseAim(event);
    });

    cardEl.addEventListener('pointermove', (event) => {
        if (event.pointerType === 'touch') return;
        if (mouseHoverCardId !== cardId) {
            setMouseHoverCard(cardId);
        }
        updateMouseAim(event);
    });

    cardEl.addEventListener('pointerleave', (event) => {
        if (event.pointerType === 'touch') return;
        if (mouseHoverCardId === cardId) {
            setMouseHoverCard(null);
        }
    });
}

function getPromptTargetCardId(preferredCardId = null) {
    if (preferredCardId && streamCards.has(preferredCardId)) {
        return preferredCardId;
    }

    if (mouseHoverCardId && streamCards.has(mouseHoverCardId)) {
        return mouseHoverCardId;
    }

    if (dotHoverCardId && streamCards.has(dotHoverCardId)) {
        return dotHoverCardId;
    }

    return null;
}

function isStreamCardActiveForVoiceEdits(cardId) {
    const cardState = cardId ? streamCards.get(cardId) : null;
    if (!cardState) return false;
    return !!(cardState.isStreaming && cardState.isConnected && cardState.client);
}

function updateCardVoiceAim(cardId, xNorm, yNorm, source = '') {
    if (!cardId || !streamCards.has(cardId)) return;
    const clampedX = Math.max(0, Math.min(1, Number(xNorm)));
    const clampedY = Math.max(0, Math.min(1, Number(yNorm)));
    if (!Number.isFinite(clampedX) || !Number.isFinite(clampedY)) return;

    cardVoiceAimState.cardId = cardId;
    cardVoiceAimState.xNorm = clampedX;
    cardVoiceAimState.yNorm = clampedY;
    cardVoiceAimState.timestamp = Date.now();
    cardVoiceAimState.source = source;

    lastClickTargetCardId = cardId;
    lastClickPos = { xPercent: clampedX, yPercent: clampedY };
}

function getRecentCardVoiceAim(cardId) {
    if (!cardId) return null;
    if (cardVoiceAimState.cardId !== cardId) return null;
    if (!Number.isFinite(cardVoiceAimState.xNorm) || !Number.isFinite(cardVoiceAimState.yNorm)) return null;
    if ((Date.now() - cardVoiceAimState.timestamp) > CARD_VOICE_AIM_MAX_AGE_MS) return null;
    return {
        xNorm: cardVoiceAimState.xNorm,
        yNorm: cardVoiceAimState.yNorm
    };
}

function getStreamingPromptTargetCardId(preferredCardId = null) {
    const targetCardId = getPromptTargetCardId(preferredCardId);
    if (isStreamCardActiveForVoiceEdits(targetCardId)) {
        return targetCardId;
    }
    return null;
}

function getLiveSpeechHoverCardId() {
    // When hand-pointing is active, trust only hand-derived hover ids.
    // This prevents stale mouse hover from stealing speech routing.
    if (isPointing) {
        return hoverPointerCardId || dotHoverCardId || null;
    }
    return hoverPointerCardId || dotHoverCardId || mouseHoverCardId || null;
}

function syncCardPromptDockState(cardState) {
    if (!cardState) return;
    cardState.cardEl?.classList.toggle('is-prompt-busy', !!cardState.isPromptSubmitting);

    const activeChip = getCardPromptChipById(cardState, cardState.activeChipId);
    cardState.promptChips?.forEach((chip) => {
        chip.isActive = activeChip ? chip.id === activeChip.id : false;
        chip.el?.classList.toggle('is-active', !!chip.isActive);
        chip.el?.classList.toggle('is-busy', !!cardState.isPromptSubmitting && chip.isActive);
        const allowCancel = chip.type !== 'seed' && (chip.isActive || chip.type === 'draft');
        const minusLabel = chip.type === 'draft'
            ? 'Cancel pending prompt'
            : 'Rollback to previous prompt';
        chip.el?.classList.toggle('can-cancel', !!allowCancel);
        chip.minusEl?.setAttribute('aria-label', minusLabel);
        chip.minusEl?.setAttribute('title', minusLabel);
        chip.minusEl?.setAttribute('aria-hidden', allowCancel ? 'false' : 'true');
    });
    refreshCardChipRevealState(cardState);
}

function hashChipString(value) {
    const text = String(value || '');
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) {
        hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
}

function ensureCardChipLayer(cardState) {
    if (!cardState?.cardEl) return null;
    if (cardState.chipLayerEl && cardState.chipLayerEl.isConnected) {
        return cardState.chipLayerEl;
    }

    let chipLayerEl = cardState.cardEl.querySelector('.video-card-chip-layer');
    if (!chipLayerEl) {
        chipLayerEl = document.createElement('div');
        chipLayerEl.className = 'video-card-chip-layer';
        cardState.cardEl.appendChild(chipLayerEl);
    }

    cardState.chipLayerEl = chipLayerEl;
    return chipLayerEl;
}

function getCardDisplayLayoutRect(cardState) {
    const cardEl = cardState?.cardEl;
    const displayEl = cardState?.displayEl;
    if (!cardEl || !displayEl) return null;

    const cardRect = cardEl.getBoundingClientRect();
    const displayRect = displayEl.getBoundingClientRect();
    if (!cardRect.width || !cardRect.height || !displayRect.width || !displayRect.height) {
        return null;
    }

    const localX = displayRect.left - cardRect.left;
    const localY = displayRect.top - cardRect.top;
    const layout = {
        cardRect,
        displayRect,
        displayWidth: displayRect.width,
        displayHeight: displayRect.height,
        displayLocalX: localX,
        displayLocalY: localY
    };

    if (cardState) {
        cardState.controlAnchorRectCache = {
            x: localX,
            y: localY,
            width: displayRect.width,
            height: displayRect.height,
            at: Date.now()
        };
    }

    return layout;
}

function getCardPromptChipById(cardState, chipId) {
    if (!cardState || !Array.isArray(cardState.promptChips) || !chipId) return null;
    return cardState.promptChips.find((chip) => chip.id === chipId) || null;
}

function setCardActiveChip(cardState, chipId = null) {
    if (!cardState) return;
    if (chipId && !getCardPromptChipById(cardState, chipId)) {
        chipId = null;
    }
    if (!chipId) {
        const fallbackChip = [...(cardState.promptChips || [])]
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
        chipId = fallbackChip?.id || null;
    }
    cardState.activeChipId = chipId || null;
    syncCardPromptDockState(cardState);
}

function buildCardChipSlots(cardWidth, cardHeight) {
    const slots = [];
    const minInsetX = 48;
    const minInsetY = 36;

    const topCount = Math.max(1, Math.floor((cardWidth - (minInsetX * 2)) / CHIP_SLOT_STEP_X) + 1);
    for (let i = 0; i < topCount; i += 1) {
        const t = topCount === 1 ? 0.5 : (i / (topCount - 1));
        const offset = minInsetX + ((cardWidth - (minInsetX * 2)) * t);
        slots.push({
            edge: 'top',
            offset,
            priority: 2
        });
    }

    const rightCount = Math.max(1, Math.floor((cardHeight - (minInsetY * 2)) / CHIP_SLOT_STEP_Y) + 1);
    for (let i = 0; i < rightCount; i += 1) {
        const t = rightCount === 1 ? 0.5 : (i / (rightCount - 1));
        const offset = minInsetY + ((cardHeight - (minInsetY * 2)) * t);
        slots.push({
            edge: 'right',
            offset,
            priority: 2
        });
    }

    const bottomCount = Math.max(1, Math.floor((cardWidth - (minInsetX * 2)) / CHIP_SLOT_STEP_X) + 1);
    for (let i = 0; i < bottomCount; i += 1) {
        const t = bottomCount === 1 ? 0.5 : (i / (bottomCount - 1));
        const offset = minInsetX + ((cardWidth - (minInsetX * 2)) * t);
        slots.push({
            edge: 'bottom',
            offset,
            priority: 2
        });
    }

    const leftCount = Math.max(1, Math.floor((cardHeight - (minInsetY * 2)) / CHIP_SLOT_STEP_Y) + 1);
    for (let i = 0; i < leftCount; i += 1) {
        const t = leftCount === 1 ? 0.5 : (i / (leftCount - 1));
        const offset = minInsetY + ((cardHeight - (minInsetY * 2)) * t);
        slots.push({
            edge: 'left',
            offset,
            priority: 2
        });
    }

    const targetTopRight = Math.max(minInsetX, cardWidth - minInsetX - 28);
    const targetBottomLeft = minInsetX + 28;
    let topRightIndex = -1;
    let bottomLeftIndex = -1;
    let topRightDistance = Infinity;
    let bottomLeftDistance = Infinity;

    slots.forEach((slot, index) => {
        if (slot.edge === 'top') {
            const distance = Math.abs(slot.offset - targetTopRight);
            if (distance < topRightDistance) {
                topRightDistance = distance;
                topRightIndex = index;
            }
        } else if (slot.edge === 'bottom') {
            const distance = Math.abs(slot.offset - targetBottomLeft);
            if (distance < bottomLeftDistance) {
                bottomLeftDistance = distance;
                bottomLeftIndex = index;
            }
        }
    });

    if (topRightIndex >= 0) {
        slots[topRightIndex].priority = 0;
    }
    if (bottomLeftIndex >= 0) {
        slots[bottomLeftIndex].priority = 1;
    }

    const edgeOrder = { top: 0, right: 1, bottom: 2, left: 3 };
    slots.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        const edgeDelta = (edgeOrder[a.edge] ?? 9) - (edgeOrder[b.edge] ?? 9);
        if (edgeDelta !== 0) return edgeDelta;

        if (a.edge === 'top') return b.offset - a.offset;      // right-first
        if (a.edge === 'bottom') return a.offset - b.offset;   // left-first
        if (a.edge === 'right') return a.offset - b.offset;
        if (a.edge === 'left') return b.offset - a.offset;
        return a.offset - b.offset;
    });

    return slots;
}

function getCardChipCandidatePosition(slot, ring, cardWidth, cardHeight) {
    const distance = Math.min(
        CHIP_MAX_DISTANCE_PX,
        CHIP_BASE_GAP_PX + (Math.max(0, ring) * CHIP_RING_STEP_PX)
    );
    const axis = Number.isFinite(slot?.offset) ? slot.offset : Number(slot?.axis || 0);
    if (slot.edge === 'top') {
        return { x: axis, y: -distance };
    }
    if (slot.edge === 'right') {
        return { x: cardWidth + distance, y: axis };
    }
    if (slot.edge === 'bottom') {
        return { x: axis, y: cardHeight + distance };
    }
    return { x: -distance, y: axis };
}

function clampCardChipCenterToViewport(localCenter, cardRect, chipWidth, chipHeight) {
    const viewportX = Math.min(
        window.innerWidth - ((chipWidth / 2) + CHIP_VIEWPORT_MARGIN),
        Math.max((chipWidth / 2) + CHIP_VIEWPORT_MARGIN, cardRect.left + localCenter.x)
    );
    const viewportY = Math.min(
        window.innerHeight - ((chipHeight / 2) + CHIP_VIEWPORT_MARGIN),
        Math.max((chipHeight / 2) + CHIP_VIEWPORT_MARGIN, cardRect.top + localCenter.y)
    );
    return {
        x: viewportX - cardRect.left,
        y: viewportY - cardRect.top
    };
}

function isLocalCenterViewportClipped(localCenter, cardRect, chipWidth, chipHeight) {
    const viewportX = cardRect.left + localCenter.x;
    const viewportY = cardRect.top + localCenter.y;
    return (
        viewportX < ((chipWidth / 2) + CHIP_VIEWPORT_MARGIN) ||
        viewportX > (window.innerWidth - ((chipWidth / 2) + CHIP_VIEWPORT_MARGIN)) ||
        viewportY < ((chipHeight / 2) + CHIP_VIEWPORT_MARGIN) ||
        viewportY > (window.innerHeight - ((chipHeight / 2) + CHIP_VIEWPORT_MARGIN))
    );
}

function getOppositeEdge(edge) {
    if (edge === 'top') return 'bottom';
    if (edge === 'bottom') return 'top';
    if (edge === 'left') return 'right';
    if (edge === 'right') return 'left';
    return edge;
}

function findNearestSlotIndexForEdge(slots, edge, offset) {
    if (!Array.isArray(slots) || !slots.length) return null;
    let bestIndex = null;
    let bestDistance = Infinity;
    slots.forEach((slot, slotIndex) => {
        if (!slot || slot.edge !== edge) return;
        const distance = Math.abs((slot.offset || 0) - (offset || 0));
        if (distance < bestDistance) {
            bestDistance = distance;
            bestIndex = slotIndex;
        }
    });
    return bestIndex;
}

function isCardChipCollision(candidateBox, occupiedBoxes) {
    return occupiedBoxes.some((box) => (
        candidateBox.left < box.right &&
        candidateBox.right > box.left &&
        candidateBox.top < box.bottom &&
        candidateBox.bottom > box.top
    ));
}

function resolveCardChipPlacement(cardState, chip, slots, anchorRect, occupiedBoxes, chipWidth, chipHeight, collisionPaddingPx = CHIP_COLLISION_PADDING_BASE) {
    const maxRing = CHIP_MAX_RING;
    const maxOrbitDistance = CHIP_MAX_DISTANCE_PX + 12;
    const slotCount = slots.length;
    if (!slotCount) {
        return {
            x: anchorRect.width / 2,
            y: -CHIP_BASE_GAP_PX,
            edge: 'top',
            offset: anchorRect.width / 2,
            slotIndex: 0,
            ring: 0
        };
    }

    const tryPlacement = (slotIndex, ring) => {
        const slot = slots[slotIndex];
        if (!slot) return null;

        const slotCandidates = [{ slot, slotIndex }];
        const rawCenter = getCardChipCandidatePosition(slot, ring, anchorRect.width, anchorRect.height);
        if (isLocalCenterViewportClipped(rawCenter, anchorRect, chipWidth, chipHeight)) {
            const oppositeEdge = getOppositeEdge(slot.edge);
            const oppositeSlotIndex = findNearestSlotIndexForEdge(slots, oppositeEdge, slot.offset);
            if (Number.isFinite(oppositeSlotIndex) && oppositeSlotIndex !== slotIndex) {
                slotCandidates.unshift({
                    slot: slots[oppositeSlotIndex],
                    slotIndex: oppositeSlotIndex
                });
            }
        }

        for (const candidate of slotCandidates) {
            const raw = getCardChipCandidatePosition(candidate.slot, ring, anchorRect.width, anchorRect.height);
            const center = clampCardChipCenterToViewport(raw, anchorRect, chipWidth, chipHeight);
            if (
                center.x < -maxOrbitDistance ||
                center.x > (anchorRect.width + maxOrbitDistance) ||
                center.y < -maxOrbitDistance ||
                center.y > (anchorRect.height + maxOrbitDistance)
            ) {
                continue;
            }
            const pad = Math.max(-2, collisionPaddingPx);
            const box = {
                left: center.x - (chipWidth / 2) - pad,
                right: center.x + (chipWidth / 2) + pad,
                top: center.y - (chipHeight / 2) - pad,
                bottom: center.y + (chipHeight / 2) + pad
            };

            if (isCardChipCollision(box, occupiedBoxes)) {
                continue;
            }

            return {
                x: center.x,
                y: center.y,
                edge: candidate.slot.edge,
                offset: candidate.slot.offset,
                slotIndex: candidate.slotIndex,
                ring,
                box
            };
        }
        return null;
    };

    let preferredSlot = Number.isFinite(chip.position?.slotIndex) ? chip.position.slotIndex : null;
    if (
        preferredSlot === null &&
        typeof chip.position?.edge === 'string' &&
        Number.isFinite(chip.position?.offset)
    ) {
        let bestIndex = null;
        let bestDistance = Infinity;
        slots.forEach((slot, slotIndex) => {
            if (slot.edge !== chip.position.edge) return;
            const distance = Math.abs((slot.offset || 0) - chip.position.offset);
            if (distance < bestDistance) {
                bestDistance = distance;
                bestIndex = slotIndex;
            }
        });
        if (bestIndex !== null) {
            preferredSlot = bestIndex;
        }
    }
    const preferredRing = Number.isFinite(chip.position?.ring) ? chip.position.ring : 0;
    if (preferredSlot !== null) {
        const preferred = tryPlacement(preferredSlot, preferredRing);
        if (preferred) {
            return preferred;
        }
    }

    const slotOrder = slots
        .map((slot, slotIndex) => ({
            slotIndex,
            score:
                (Number.isFinite(slot.priority) ? slot.priority : 2) * 100000 +
                hashChipString(`${cardState.id}:${chip.id}:${slot.edge}:${Math.round(slot.offset || 0)}`)
        }))
        .sort((a, b) => {
            if (a.score === b.score) return a.slotIndex - b.slotIndex;
            return a.score - b.score;
        })
        .map((entry) => entry.slotIndex);

    for (let ring = 0; ring <= maxRing; ring += 1) {
        for (const slotIndex of slotOrder) {
            const resolved = tryPlacement(slotIndex, ring);
            if (resolved) {
                return resolved;
            }
        }
    }

    const fallbackSlot = slotOrder[0] ?? 0;
    const fallbackRing = Math.min(maxRing, CHIP_MAX_RING);
    const fallbackCenter = getCardChipCandidatePosition(slots[fallbackSlot], fallbackRing, anchorRect.width, anchorRect.height);
    const fallback = clampCardChipCenterToViewport(fallbackCenter, anchorRect, chipWidth, chipHeight);
    fallback.x = Math.min(anchorRect.width + maxOrbitDistance, Math.max(-maxOrbitDistance, fallback.x));
    fallback.y = Math.min(anchorRect.height + maxOrbitDistance, Math.max(-maxOrbitDistance, fallback.y));
    return {
        x: fallback.x,
        y: fallback.y,
        edge: slots[fallbackSlot]?.edge || 'top',
        offset: slots[fallbackSlot]?.offset || (anchorRect.width / 2),
        slotIndex: fallbackSlot,
        ring: fallbackRing,
        box: {
            left: fallback.x - (chipWidth / 2),
            right: fallback.x + (chipWidth / 2),
            top: fallback.y - (chipHeight / 2),
            bottom: fallback.y + (chipHeight / 2)
        }
    };
}

function layoutCardChips(cardState) {
    if (!cardState?.cardEl || !Array.isArray(cardState.promptChips) || !cardState.promptChips.length) {
        return;
    }

    const layoutRect = getCardDisplayLayoutRect(cardState);
    if (!layoutRect) return;
    const {
        displayRect,
        displayWidth,
        displayHeight,
        displayLocalX,
        displayLocalY
    } = layoutRect;

    const slots = buildCardChipSlots(displayWidth, displayHeight);
    const occupiedBoxes = [];
    const controlsRect = cardState.controlsEl?.getBoundingClientRect?.();
    if (controlsRect && controlsRect.width > 0 && controlsRect.height > 0) {
        const controlsReservedInset = 8;
        const reservedLeft = (controlsRect.left - displayRect.left) - controlsReservedInset;
        const reservedRight = (controlsRect.right - displayRect.left) + controlsReservedInset;
        const reservedTop = (controlsRect.top - displayRect.top) - controlsReservedInset;
        const reservedBottom = (controlsRect.bottom - displayRect.top) + controlsReservedInset;
        occupiedBoxes.push({
            left: Math.max(-CHIP_MAX_DISTANCE_PX, reservedLeft),
            right: Math.min(displayWidth + CHIP_MAX_DISTANCE_PX, reservedRight),
            top: Math.max(-CHIP_MAX_DISTANCE_PX, reservedTop),
            bottom: Math.min(displayHeight + CHIP_MAX_DISTANCE_PX, reservedBottom)
        });
    } else {
        const controlsReservedWidth = 102;
        const controlsReservedHeight = 48;
        const controlsReservedInset = 6;
        occupiedBoxes.push({
            left: Math.max(0, displayWidth - controlsReservedWidth - controlsReservedInset),
            right: displayWidth + controlsReservedInset,
            top: -controlsReservedInset,
            bottom: controlsReservedHeight
        });
    }
    const sortedChips = [...cardState.promptChips]
        .sort((a, b) => {
            if (a.type === 'seed' && b.type !== 'seed') return -1;
            if (b.type === 'seed' && a.type !== 'seed') return 1;
            return (b.createdAt || 0) - (a.createdAt || 0);
        });

    sortedChips.forEach((chip, layoutIndex) => {
        if (!chip?.el || !chip.el.isConnected) return;
        const chipRect = chip.el.getBoundingClientRect();
        const chipWidth = Math.max(140, chipRect.width || chip.el.offsetWidth || 160);
        const chipHeight = Math.max(38, chipRect.height || chip.el.offsetHeight || 42);
        const collisionPaddingPx = chip.type === 'seed'
            ? 10
            : Math.max(-2, CHIP_COLLISION_PADDING_BASE - Math.floor(layoutIndex / 4));
        const placement = resolveCardChipPlacement(
            cardState,
            chip,
            slots,
            displayRect,
            occupiedBoxes,
            chipWidth,
            chipHeight,
            collisionPaddingPx
        );
        chip.position = {
            edge: placement.edge,
            offset: placement.offset,
            slotIndex: placement.slotIndex,
            ring: placement.ring
        };
        chip.el.style.left = `${displayLocalX + placement.x}px`;
        chip.el.style.top = `${displayLocalY + placement.y}px`;
        occupiedBoxes.push(placement.box);
    });
}

function scheduleCardChipLayout(cardState, options = {}) {
    if (!cardState?.id || !cardState.cardEl?.isConnected) return;
    const force = !!options.force;
    const existing = cardChipLayoutRaf.get(cardState.id);
    if (existing && !force) {
        return;
    }
    if (existing) {
        cancelAnimationFrame(existing);
        cardChipLayoutRaf.delete(cardState.id);
    }

    const layoutVersion = (Number(cardState.chipLayoutVersion) || 0) + 1;
    cardState.chipLayoutVersion = layoutVersion;
    const rafId = requestAnimationFrame(() => {
        cardChipLayoutRaf.delete(cardState.id);
        if ((Number(cardState.chipLayoutVersion) || 0) !== layoutVersion) {
            return;
        }
        layoutCardChips(cardState);
    });
    cardChipLayoutRaf.set(cardState.id, rafId);
}

function removeCardPromptChip(cardState, chipId, options = {}) {
    if (!cardState || !chipId) return null;
    const chipIndex = (cardState.promptChips || []).findIndex((chip) => chip.id === chipId);
    if (chipIndex < 0) return null;
    const [removedChip] = cardState.promptChips.splice(chipIndex, 1);
    removedChip?.el?.remove();

    if (cardState.pendingSpeechChipId === chipId) {
        cardState.pendingSpeechChipId = null;
        cardState.pendingSpeechDraftText = '';
    }
    if (cardState.activeChipId === chipId) {
        cardState.activeChipId = null;
    }

    const skipLayout = !!options.skipLayout;
    if (!skipLayout) {
        setCardActiveChip(cardState, null);
        scheduleCardChipLayout(cardState);
    }
    return removedChip;
}

function createCardPromptChip(cardState, options = {}) {
    if (!cardState?.cardEl) return null;
    const chipLayerEl = ensureCardChipLayer(cardState);
    if (!chipLayerEl) return null;

    const textValue = String(options.text || options.finalPrompt || '').trim();
    const finalPromptValue = String(options.finalPrompt || textValue).trim();
    const chipType = options.type === 'seed' || options.type === 'draft' ? options.type : 'final';
    const chipId = typeof options.id === 'string' && options.id.trim()
        ? options.id.trim()
        : `${cardState.id}-chip-${++streamCardChipCounter}`;

    const chipEl = document.createElement('div');
    chipEl.className = 'video-card-chip liquid-glass';
    chipEl.dataset.chipId = chipId;
    chipEl.dataset.type = chipType;
    chipEl.innerHTML = `
        <div class="liquid-glass__rim" aria-hidden="true"></div>
        <button class="video-card-chip-minus" type="button" aria-label="Cancel prompt change" title="Cancel prompt change">
            <span aria-hidden="true">&minus;</span>
        </button>
        <span class="video-card-chip-text"></span>
    `;

    const chipTextEl = chipEl.querySelector('.video-card-chip-text');
    const chipMinusEl = chipEl.querySelector('.video-card-chip-minus');
    if (chipTextEl) {
        chipTextEl.textContent = textValue || finalPromptValue || '...';
    }

    const chip = {
        id: chipId,
        type: chipType,
        source: String(options.source || (chipType === 'seed' ? 'seed' : 'voice')),
        text: textValue || finalPromptValue || '...',
        finalPrompt: finalPromptValue || textValue || '',
        createdAt: Number.isFinite(options.createdAt) ? options.createdAt : Date.now(),
        isCommitted: options.isCommitted !== false && chipType !== 'draft',
        position: {
            edge: typeof options.position?.edge === 'string' ? options.position.edge : null,
            offset: Number.isFinite(options.position?.offset) ? options.position.offset : null,
            slotIndex: Number.isFinite(options.position?.slotIndex) ? options.position.slotIndex : null,
            ring: Number.isFinite(options.position?.ring) ? options.position.ring : 0
        },
        el: chipEl,
        textEl: chipTextEl,
        minusEl: chipMinusEl,
        isActive: false
    };

    chipMinusEl?.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        await cancelActiveChip(cardState, chip.id);
    });

    chipEl.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
        bringCardToFront(cardState.cardEl);
        setActiveStream('secondary', cardState.id);
        setCardActiveChip(cardState, chip.id);
    });

    chipLayerEl.appendChild(chipEl);
    assignLiquidGlassPhase(chipEl);
    cardState.promptChips.push(chip);
    setCardActiveChip(cardState, chip.id);
    scheduleCardChipLayout(cardState);
    return chip;
}

function createSeedChip(cardState, promptText = '') {
    if (!cardState) return null;
    const text = String(promptText || cardState.seedPrompt || '').trim();
    if (!text) return null;

    let seedChip = (cardState.promptChips || []).find((chip) => chip.type === 'seed') || null;
    if (seedChip) {
        seedChip.type = 'seed';
        seedChip.el && (seedChip.el.dataset.type = 'seed');
        seedChip.text = text;
        seedChip.finalPrompt = text;
        seedChip.source = 'seed';
        seedChip.isCommitted = true;
        if (seedChip.textEl) seedChip.textEl.textContent = text;
        scheduleCardChipLayout(cardState);
        scheduleActiveProjectAutosave();
        return seedChip;
    }

    seedChip = createCardPromptChip(cardState, {
        type: 'seed',
        source: 'seed',
        text,
        finalPrompt: text,
        isCommitted: true
    });
    if (seedChip && !cardState.activeChipId) {
        setCardActiveChip(cardState, seedChip.id);
    }
    scheduleActiveProjectAutosave();
    return seedChip;
}

function startDraftSpeechChip(cardState) {
    if (!cardState) return null;
    if (cardState.pendingSpeechChipId) {
        const existingDraft = getCardPromptChipById(cardState, cardState.pendingSpeechChipId);
        if (existingDraft) {
            setCardActiveChip(cardState, existingDraft.id);
            return existingDraft;
        }
        cardState.pendingSpeechChipId = null;
    }

    const draftChip = createCardPromptChip(cardState, {
        type: 'draft',
        source: 'voice',
        text: cardState.pendingSpeechDraftText || 'Listening...',
        finalPrompt: '',
        isCommitted: false
    });
    if (!draftChip) return null;
    cardState.pendingSpeechChipId = draftChip.id;
    cardState.pendingSpeechDraftText = draftChip.text;
    syncCardPromptDockState(cardState);
    return draftChip;
}

function updateDraftSpeechChipText(cardState, text) {
    if (!cardState) return null;
    const normalizedText = String(text || '').trim();
    if (!normalizedText) return null;

    const draftChip = startDraftSpeechChip(cardState);
    if (!draftChip) return null;

    draftChip.text = normalizedText;
    draftChip.finalPrompt = normalizedText;
    draftChip.textEl && (draftChip.textEl.textContent = normalizedText);
    cardState.pendingSpeechDraftText = normalizedText;
    setCardActiveChip(cardState, draftChip.id);
    scheduleCardChipLayout(cardState);
    return draftChip;
}

function commitDraftChip(cardState, finalPrompt, options = {}) {
    if (!cardState) return null;
    const normalizedPrompt = String(finalPrompt || '').trim();
    if (!normalizedPrompt) return null;

    let targetChip = cardState.pendingSpeechChipId
        ? getCardPromptChipById(cardState, cardState.pendingSpeechChipId)
        : null;
    if (!targetChip) {
        targetChip = createCardPromptChip(cardState, {
            type: 'final',
            source: options.source || 'voice',
            text: normalizedPrompt,
            finalPrompt: normalizedPrompt,
            isCommitted: true
        });
    } else {
        targetChip.type = 'final';
        targetChip.el && (targetChip.el.dataset.type = 'final');
        targetChip.source = options.source || targetChip.source || 'voice';
        targetChip.isCommitted = true;
        targetChip.text = normalizedPrompt;
        targetChip.finalPrompt = normalizedPrompt;
        targetChip.textEl && (targetChip.textEl.textContent = normalizedPrompt);
    }

    cardState.pendingSpeechChipId = null;
    cardState.pendingSpeechDraftText = '';
    setCardActiveChip(cardState, targetChip?.id || null);
    scheduleCardChipLayout(cardState);
    scheduleActiveProjectAutosave();
    return targetChip;
}

function getLastCommittedChip(cardState, options = {}) {
    const excludeChipId = options.excludeChipId || null;
    const committed = (cardState?.promptChips || [])
        .filter((chip) => chip.type !== 'draft' && chip.isCommitted && chip.id !== excludeChipId)
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return committed[0] || null;
}

async function rollbackCardToPreviousPrompt(cardState, options = {}) {
    if (!cardState) return false;
    const excludeChipId = options.excludeChipId || null;
    const fallbackPrompt = String(cardState.seedPrompt || '').trim();
    const previousChip = getLastCommittedChip(cardState, { excludeChipId });
    const rollbackPrompt = String(previousChip?.finalPrompt || previousChip?.text || fallbackPrompt || '').trim();
    if (!rollbackPrompt) return false;
    if (cardState.isPromptSubmitting) return false;

    cardState.isPromptSubmitting = true;
    syncCardPromptDockState(cardState);
    setGeneratingIndicator(true);

    try {
        await applyPromptToCard(cardState.id, rollbackPrompt);
        cardState.lastAppliedPrompt = rollbackPrompt;
        currentSceneState = rollbackPrompt;
        return true;
    } catch (error) {
        console.error('Card rollback error:', error);
        return false;
    } finally {
        cardState.isPromptSubmitting = false;
        syncCardPromptDockState(cardState);
        setGeneratingIndicator(false);
    }
}

async function cancelActiveChip(cardState, preferredChipId = null) {
    if (!cardState) return false;
    const targetChip = getCardPromptChipById(cardState, preferredChipId || cardState.activeChipId);
    if (!targetChip || targetChip.type === 'seed') return false;

    if (targetChip.type === 'draft' || !targetChip.isCommitted) {
        removeCardPromptChip(cardState, targetChip.id);
        cardState.skipNextVoiceCommitUntil = Date.now() + 2200;
        setCardActiveChip(cardState, getLastCommittedChip(cardState)?.id || null);
        scheduleActiveProjectAutosave();
        return true;
    }

    const rolledBack = await rollbackCardToPreviousPrompt(cardState, { excludeChipId: targetChip.id });
    if (!rolledBack) return false;

    removeCardPromptChip(cardState, targetChip.id);
    setCardActiveChip(cardState, getLastCommittedChip(cardState)?.id || null);
    scheduleActiveProjectAutosave();
    return true;
}

function normalizeCardStatusText(value) {
    return String(value || '').trim();
}

function getCardStatusState(statusText) {
    const normalized = normalizeCardStatusText(statusText).toLowerCase();
    if (/^error\b/.test(normalized)) return 'error';
    if (/^streaming\b/.test(normalized)) return 'streaming';
    if (/^replay\b/.test(normalized)) return 'replay';
    if (/^frozen\b/.test(normalized)) return 'frozen';
    if (/^timed out\b/.test(normalized)) return 'error';
    if (/^retrying\b/.test(normalized)) return 'connecting';
    if (/^connecting\b/.test(normalized)) return 'connecting';
    if (/^credentials\b/.test(normalized)) return 'connecting';
    if (/^preparing\b/.test(normalized)) return 'connecting';
    if (/^prompting\b/.test(normalized)) return 'connecting';
    if (/^starting\b/.test(normalized)) return 'connecting';
    if (/^resuming\b/.test(normalized)) return 'connecting';
    if (/^recovering\b/.test(normalized)) return 'connecting';
    if (/^applying\b/.test(normalized)) return 'connecting';
    return 'default';
}

function getCardLifecycleStepIndex(statusText) {
    const normalized = normalizeCardStatusText(statusText).toLowerCase();
    if (/^preparing\b|^prompting\b/.test(normalized)) return 0;
    if (/^credentials\b|^connecting\b|^retrying\b|^resuming\b|^recovering\b/.test(normalized)) return 1;
    if (/^starting\b/.test(normalized)) return 2;
    if (/^streaming\b|^applying\b/.test(normalized)) return 3;
    if (/^replay\b|^frozen\b|^stopped\b|^error\b|^timed out\b/.test(normalized)) return 4;
    return 0;
}

function syncCardCenteredLoadingState(cardState, statusText) {
    const loadingOverlayEl = cardState?.centerLoadingEl;
    const cardEl = cardState?.cardEl;
    if (!loadingOverlayEl) return;

    const normalizedStatus = normalizeCardStatusText(statusText);
    const isConnecting = /^(connecting|retrying|credentials|preparing|prompting|starting|resuming|recovering)\b/i.test(normalizedStatus);
    loadingOverlayEl.classList.toggle('active', isConnecting);
    cardEl?.classList.toggle('is-center-loading', isConnecting);
}

function updateCardLifecycleUI(cardState, statusText) {
    if (!cardState?.lifecycleEl) return;
    const normalizedStatus = normalizeCardStatusText(statusText) || 'Stopped';
    const statusState = getCardStatusState(normalizedStatus);
    cardState.lifecycleEl.dataset.statusState = statusState;
    if (cardState.lifecycleTextEl) {
        cardState.lifecycleTextEl.textContent = normalizedStatus;
    }

    const now = Date.now();
    if (!Array.isArray(cardState.statusHistory)) {
        cardState.statusHistory = [];
    }
    const last = cardState.statusHistory[cardState.statusHistory.length - 1];
    if (!last || last.status !== normalizedStatus) {
        cardState.statusHistory.push({ status: normalizedStatus, ts: now });
        if (cardState.statusHistory.length > CARD_STATUS_HISTORY_LIMIT) {
            cardState.statusHistory.splice(0, cardState.statusHistory.length - CARD_STATUS_HISTORY_LIMIT);
        }
    }

    if (!cardState.lifecycleStepsEl) return;
    const currentStep = getCardLifecycleStepIndex(normalizedStatus);
    const labels = ['Prepare', 'Connect', 'Start', 'Live', 'Fallback'];
    cardState.lifecycleStepsEl.textContent = '';
    labels.forEach((label, index) => {
        const stepEl = document.createElement('span');
        stepEl.className = 'card-lifecycle-step';
        if (index < currentStep) stepEl.classList.add('is-done');
        if (index === currentStep) stepEl.classList.add('is-current');
        stepEl.title = label;
        stepEl.setAttribute('aria-label', label);
        cardState.lifecycleStepsEl.appendChild(stepEl);
    });
}

function createEmptyCardPromptAudit(seedPrompt = '') {
    const seed = String(seedPrompt || '').trim();
    return {
        rawText: '',
        appliedText: seed,
        lastSentPrompt: seed,
        route: 'idle',
        modifiers: {
            location: false,
            emotion: false,
            audio: false,
            asr: false
        },
        updatedAt: 0
    };
}

function formatPromptAuditValue(value) {
    return String(value || '').trim() || '--';
}

function formatPromptAuditModifiers(modifiers = {}) {
    const active = [];
    if (modifiers.location) active.push('location');
    if (modifiers.emotion) active.push('emotion');
    if (modifiers.audio) active.push('audio');
    if (modifiers.asr) active.push('ASR alternative');
    return active.length ? active.join(', ') : 'none';
}

function syncCardPromptAuditUI(cardState) {
    if (!cardState?.auditEls) return;
    const audit = cardState.promptAudit || createEmptyCardPromptAudit(cardState.seedPrompt || cardState.lastAppliedPrompt);
    const { rawEl, appliedEl, sentEl, routeEl, modifiersEl } = cardState.auditEls;
    if (rawEl) rawEl.textContent = formatPromptAuditValue(audit.rawText);
    if (appliedEl) appliedEl.textContent = formatPromptAuditValue(audit.appliedText);
    if (sentEl) sentEl.textContent = formatPromptAuditValue(audit.lastSentPrompt);
    if (routeEl) routeEl.textContent = formatPromptAuditValue(audit.route);
    if (modifiersEl) modifiersEl.textContent = formatPromptAuditModifiers(audit.modifiers);
}

function updateCardPromptAudit(cardState, patch = {}) {
    if (!cardState) return;
    const prev = cardState.promptAudit || createEmptyCardPromptAudit(cardState.seedPrompt || cardState.lastAppliedPrompt);
    const nextModifiers = Object.prototype.hasOwnProperty.call(patch, 'modifiers')
        ? {
            location: false,
            emotion: false,
            audio: false,
            asr: false,
            ...(patch.modifiers || {})
        }
        : { ...prev.modifiers };
    if ('locationApplied' in patch) nextModifiers.location = !!patch.locationApplied;
    if ('emotionApplied' in patch) nextModifiers.emotion = !!patch.emotionApplied;
    if ('audioApplied' in patch) nextModifiers.audio = !!patch.audioApplied;
    if ('asrApplied' in patch) nextModifiers.asr = !!patch.asrApplied;

    cardState.promptAudit = {
        ...prev,
        ...patch,
        modifiers: nextModifiers,
        updatedAt: Date.now()
    };
    delete cardState.promptAudit.locationApplied;
    delete cardState.promptAudit.emotionApplied;
    delete cardState.promptAudit.audioApplied;
    delete cardState.promptAudit.asrApplied;
    syncCardPromptAuditUI(cardState);
}

function setCardStatusText(cardState, value) {
    if (!cardState?.statusEl) return;
    const statusText = normalizeCardStatusText(value) || 'Stopped';
    const statusState = getCardStatusState(statusText);
    cardState.statusEl.classList.remove('is-recording');
    cardState.statusEl.classList.remove('is-frozen');
    cardState.statusEl.classList.remove('is-icon-only');
    cardState.statusEl.classList.add('is-dot');
    cardState.statusEl.dataset.statusState = statusState;
    cardState.statusEl.textContent = '';
    cardState.statusEl.setAttribute('aria-label', statusText);
    cardState.statusEl.title = statusText;

    syncCardCenteredLoadingState(cardState, statusText);
    updateCardLifecycleUI(cardState, statusText);
}

function setCardPromptDraft(cardId, text, options = {}) {
    const cardState = streamCards.get(cardId);
    if (!cardState) return false;
    const trackChange = options.trackChange !== false;
    const normalizedText = String(text || '').trim();
    if (!normalizedText) return false;

    updateDraftSpeechChipText(cardState, normalizedText);
    if (trackChange) {
        scheduleActiveProjectAutosave();
    }
    return true;
}

async function submitPromptToExistingCard(cardId, rawText) {
    const cardState = streamCards.get(cardId);
    const text = String(rawText || '').trim();
    if (!cardState || !text || cardState.isPromptSubmitting) return false;

    cardState.isPromptSubmitting = true;
    syncCardPromptDockState(cardState);

    try {
        setGeneratingIndicator(true);
        updateDraftSpeechChipText(cardState, text);
        await applyPromptToCard(cardId, text, {
            rawText: text,
            route: 'manual-card-edit',
            modifiers: {}
        });
        commitDraftChip(cardState, text, { source: 'manual' });

        interactionCount++;
        setInteractionCountDisplay(interactionCount);
        currentSceneState = text;
        storyContext.push(text);
        if (storyContext.length > 10) storyContext.shift();

        scheduleActiveProjectAutosave();
        return true;
    } catch (error) {
        console.error('Card prompt submit error:', error);
        if (cardState.pendingSpeechChipId) {
            removeCardPromptChip(cardState, cardState.pendingSpeechChipId);
            setCardActiveChip(cardState, getLastCommittedChip(cardState)?.id || null);
        }
        return false;
    } finally {
        cardState.isPromptSubmitting = false;
        syncCardPromptDockState(cardState);
        setGeneratingIndicator(false);
    }
}

function isSenseRuntimeActive() {
    return appSessionActive && videoSection?.style.display !== 'none';
}

async function ensureVoiceRuntimeReady() {
    if (!speechEnabled || !isSenseRuntimeActive()) return;
    if (voiceBootstrapInFlight) {
        await voiceBootstrapInFlight;
        return;
    }

    voiceBootstrapInFlight = (async () => {
        if (!hasLiveAudioTrack(window.microphoneStream)) {
            await warmMediaDeviceStreams({ needMic: true, needCamera: false });
        }
        if (!hasLiveAudioTrack(window.microphoneStream)) {
            window.microphoneStream = await requestMicrophoneStream();
        }

        if (!recognition) {
            startSpeechRecognition();
        } else {
            try {
                applySpeechRecognitionHints(recognition);
                recognition.start();
            } catch (_) {
                // no-op; recognition may already be running
            }
        }

        if (!audioContext || audioContext.state === 'closed') {
            await setupAudioAnalysis();
        } else if (audioContext.state === 'suspended') {
            try {
                await audioContext.resume();
            } catch (_) {
                // no-op
            }
            if (analyser && !audioAnalysisFrameId && !audioAnalysisTimeoutId) {
                analyzeAudioContinuously();
            }
        }
    })();

    try {
        await voiceBootstrapInFlight;
    } finally {
        voiceBootstrapInFlight = null;
    }
}

function createEmptySpeechMeta() {
    return {
        rawText: '',
        appliedText: '',
        route: 'idle',
        stage: 'idle',
        asr: {
            usedAlternative: false,
            primaryConfidence: 0,
            chosenConfidence: 0
        },
        locationRewrite: false,
        emotionApplied: false,
        audioApplied: false
    };
}

function formatSpeechConfidence(value) {
    if (!Number.isFinite(value) || value <= 0) {
        return 'n/a';
    }
    return `${Math.round(value * 100)}%`;
}

function renderPromptModifierIcons(meta) {
    if (!promptModifierIconsEl) return;
    promptModifierIconsEl.textContent = '';

    const activeIcons = [
        {
            active: !!meta.locationRewrite,
            className: 'modifier-icon modifier-icon--location',
            text: 'LOC',
            label: 'Location grounding applied'
        },
        {
            active: !!meta.emotionApplied,
            className: 'modifier-icon modifier-icon--emotion',
            text: 'EMO',
            label: 'Emotion modifier applied'
        },
        {
            active: !!meta.audioApplied,
            className: 'modifier-icon modifier-icon--audio',
            text: 'AUD',
            label: 'Audio tone modifier applied'
        },
        {
            active: !!meta.asr?.usedAlternative,
            className: 'modifier-icon modifier-icon--asr',
            text: 'ASR',
            label: `Speech alternative selected (${formatSpeechConfidence(meta.asr?.primaryConfidence)} -> ${formatSpeechConfidence(meta.asr?.chosenConfidence)})`
        }
    ];

    activeIcons.forEach((icon) => {
        if (!icon.active) return;
        const iconEl = document.createElement('span');
        iconEl.className = icon.className;
        iconEl.textContent = icon.text;
        iconEl.title = icon.label;
        iconEl.setAttribute('aria-label', icon.label);
        iconEl.setAttribute('role', 'img');
        promptModifierIconsEl.appendChild(iconEl);
    });
}

let statusIndicatorTimer = null;

const EMOTION_COLORS = {
    happy:     { bg: 'rgba(134,239,172,0.55)',  border: '#4ade80' },
    sad:       { bg: 'rgba(147,197,253,0.55)',  border: '#60a5fa' },
    angry:     { bg: 'rgba(252,165,165,0.55)',  border: '#f87171' },
    fearful:   { bg: 'rgba(252,165,165,0.40)',  border: '#fca5a5' },
    disgusted: { bg: 'rgba(216,180,254,0.45)',  border: '#c084fc' },
    surprised: { bg: 'rgba(253,230,138,0.55)',  border: '#fbbf24' },
    neutral:   { bg: 'rgba(253,230,138,0.40)',  border: '#fbbf24' },
};

function applyEmotionColors(emotion) {
    const colors = EMOTION_COLORS[emotion] || EMOTION_COLORS.neutral;
    const statusEl = document.getElementById('statusIndicator');
    const statusInner = statusEl?.querySelector('.status-indicator-inner');
    const cameraPreview = document.querySelector('.sense-preview-card .camera-preview');

    if (statusInner) {
        statusInner.style.background = colors.bg;
        statusInner.style.borderColor = colors.border;
    }
    if (cameraPreview) {
        cameraPreview.style.boxShadow = `0 0 0 2px ${colors.border}`;
        cameraPreview.style.borderRadius = '10px';
    }
}

function showStatusIndicator(text) {
    const el = document.getElementById('statusIndicator');
    const textEl = document.getElementById('statusText');
    if (!el || !textEl) return;
    textEl.textContent = text;
    el.classList.add('is-visible');
    clearTimeout(statusIndicatorTimer);
    statusIndicatorTimer = setTimeout(() => {
        el.classList.remove('is-visible');
    }, 4000);
}

function renderSpeechFeedbackMeta() {
    const meta = latestSpeechMeta || createEmptySpeechMeta();
    if (speechHeardTextEl) {
        speechHeardTextEl.textContent = meta.rawText || '--';
    }
    if (speechAppliedTextEl) {
        speechAppliedTextEl.textContent = meta.appliedText || '--';
    }
    if (meta.appliedText && meta.appliedText !== '--') {
        showStatusIndicator(meta.appliedText);
    }
    renderPromptModifierIcons(meta);
}

function patchSpeechMeta(patch = {}) {
    const prev = latestSpeechMeta || createEmptySpeechMeta();
    const nextAsrPatch = (patch.asr && typeof patch.asr === 'object') ? patch.asr : {};

    latestSpeechMeta = {
        ...prev,
        ...patch,
        asr: {
            ...prev.asr,
            ...nextAsrPatch
        }
    };
    renderSpeechFeedbackMeta();
}

function resetSpeechMeta(options = {}) {
    const preserveRaw = !!options.preserveRaw;
    const base = createEmptySpeechMeta();
    if (preserveRaw) {
        base.rawText = String(latestSpeechMeta?.rawText || '').trim();
    }
    latestSpeechMeta = base;
    renderSpeechFeedbackMeta();
}

function normalizeLocationHint(locationHint) {
    return String(locationHint || '')
        .replace(/\s+/g, ' ')
        .replace(/^[,.;:\s]+|[,.;:\s]+$/g, '')
        .trim();
}

function applyLocationHintToPrompt(userPrompt, locationHint) {
    const basePrompt = String(userPrompt || '').trim();
    if (!basePrompt) {
        return {
            prompt: '',
            locationApplied: false,
            locationHint: ''
        };
    }

    const normalizedHint = normalizeLocationHint(locationHint);
    if (!normalizedHint) {
        return {
            prompt: basePrompt,
            locationApplied: false,
            locationHint: ''
        };
    }

    const replaced = basePrompt.replace(/\b(here|there|this area|that area|this spot|that spot)\b/gi, normalizedHint);
    const prompt = (replaced === basePrompt ? `${basePrompt} ${normalizedHint}` : replaced)
        .replace(/\s+/g, ' ')
        .trim();

    return {
        prompt,
        locationApplied: true,
        locationHint: normalizedHint
    };
}

function appendPromptModifierClause(promptText, clause) {
    const base = String(promptText || '').trim().replace(/[,\s]+$/g, '');
    const normalizedClause = String(clause || '').trim().replace(/^[,\s]+|[,\s]+$/g, '');
    if (!base) return normalizedClause;
    if (!normalizedClause) return base;
    if (base.toLowerCase().includes(normalizedClause.toLowerCase())) {
        return base;
    }
    return `${base}, ${normalizedClause}`;
}

function getDeterministicEmotionAdjective(emotion, confidence) {
    const adjectives = emotionAdjectives[emotion] || [];
    if (!adjectives.length) return '';
    const percent = Math.max(0, Math.min(100, Math.round(Number(confidence || 0) * 100)));
    if (percent < 75) return adjectives[0] || '';
    if (percent < 90) return adjectives[2] || adjectives[1] || adjectives[0] || '';
    return adjectives[4] || adjectives[adjectives.length - 1] || '';
}

function getAudioModifierClause(audioFeatures = {}) {
    const volume = Number(audioFeatures.volume || 0);
    const energy = Number(audioFeatures.energy || 0);
    const pitch = String(audioFeatures.pitch || '').toLowerCase();

    if (volume >= SPEECH_AUDIO_LOUD_THRESHOLD || energy >= SPEECH_AUDIO_HIGH_ENERGY_THRESHOLD) {
        return 'with heightened intensity';
    }
    if (volume <= SPEECH_AUDIO_QUIET_THRESHOLD && energy <= SPEECH_AUDIO_LOW_ENERGY_THRESHOLD) {
        return 'with a calm, subdued atmosphere';
    }
    if (pitch === 'high' && volume >= 35) {
        return 'with a bright, energetic tone';
    }
    if ((pitch === 'low' || pitch === 'very-low') && energy >= 32) {
        return 'with a darker, serious tone';
    }
    return '';
}

function applySpeechPromptModifiers(promptText, options = {}) {
    let nextPrompt = String(promptText || '').trim();
    if (!nextPrompt) {
        return {
            prompt: '',
            emotionApplied: false,
            audioApplied: false
        };
    }

    let emotionApplied = false;
    let audioApplied = false;
    const includeEmotion = options.includeEmotion !== false;
    const includeAudio = options.includeAudio !== false;

    if (
        includeEmotion &&
        senseVision?.checked &&
        faceDetectionEnabled &&
        currentEmotion &&
        currentEmotion !== 'neutral' &&
        emotionConfidence >= SPEECH_EMOTION_CONFIDENCE_THRESHOLD
    ) {
        const adjective = getDeterministicEmotionAdjective(currentEmotion, emotionConfidence);
        if (adjective) {
            nextPrompt = appendPromptModifierClause(nextPrompt, `with a ${adjective} mood`);
            emotionApplied = true;
        }
    }

    if (includeAudio) {
        const audioClause = getAudioModifierClause(options.audioFeatures || currentAudioFeatures);
        if (audioClause) {
            nextPrompt = appendPromptModifierClause(nextPrompt, audioClause);
            audioApplied = true;
        }
    }

    return {
        prompt: nextPrompt,
        emotionApplied,
        audioApplied
    };
}

function extractSpeechHintTokens(text) {
    return String(text || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 3);
}

function getLatestCardPromptText(cardState) {
    if (!cardState) return '';

    if (cardState.pendingSpeechChipId) {
        const draft = getCardPromptChipById(cardState, cardState.pendingSpeechChipId);
        if (draft?.text) {
            return draft.text;
        }
    }

    const latestCommitted = getLastCommittedChip(cardState);
    if (latestCommitted?.text) {
        return latestCommitted.text;
    }

    return String(cardState.lastAppliedPrompt || cardState.seedPrompt || '');
}

function collectDynamicSpeechHints() {
    const hints = new Set(BASE_SPEECH_HINT_PHRASES);

    extractSpeechHintTokens(promptInput?.value || '').forEach((token) => hints.add(token));
    const activeHintCardId = hoverPointerCardId || dotHoverCardId || mouseHoverCardId || activeStreamCardId || lastClickTargetCardId || null;
    const activeCardState = activeHintCardId ? streamCards.get(activeHintCardId) : null;
    extractSpeechHintTokens(getLatestCardPromptText(activeCardState)).forEach((token) => hints.add(token));

    return hints;
}

function scoreSpeechCandidateTranscript(transcript, confidence, hintTokens) {
    const tokens = extractSpeechHintTokens(transcript);
    let score = Number.isFinite(confidence) ? confidence : 0;
    let hintMatches = 0;

    for (const token of tokens) {
        if (hintTokens.has(token)) {
            hintMatches += 1;
        }
    }

    // Keep hint influence intentionally weak so recognized words stay literal.
    score += Math.min(SPEECH_HINT_MAX_SCORE_BONUS, hintMatches * SPEECH_HINT_SCORE_STEP);

    return score;
}

function chooseSpeechTranscriptFromAlternatives(resultItem, hintTokens) {
    if (!resultItem || !resultItem.length) {
        return {
            transcript: '',
            usedAlternative: false,
            primaryConfidence: 0,
            chosenConfidence: 0
        };
    }

    const primaryTranscript = String(resultItem[0]?.transcript || '');
    if (!primaryTranscript) {
        return {
            transcript: '',
            usedAlternative: false,
            primaryConfidence: 0,
            chosenConfidence: 0
        };
    }

    const primaryConfidenceRaw = Number(resultItem[0]?.confidence);
    const primaryConfidence = Number.isFinite(primaryConfidenceRaw) ? primaryConfidenceRaw : 0;
    const alternativesCount = Math.min(resultItem.length, SPEECH_RESULT_MAX_ALTERNATIVES);
    if (alternativesCount < 2) {
        return {
            transcript: primaryTranscript,
            usedAlternative: false,
            primaryConfidence,
            chosenConfidence: primaryConfidence
        };
    }

    // Prefer the browser's top hypothesis; only override on clear confidence advantage.
    if (primaryConfidence >= SPEECH_ALT_PRIMARY_KEEP_THRESHOLD) {
        return {
            transcript: primaryTranscript,
            usedAlternative: false,
            primaryConfidence,
            chosenConfidence: primaryConfidence
        };
    }

    let bestTranscript = primaryTranscript;
    let bestScore = scoreSpeechCandidateTranscript(primaryTranscript, primaryConfidence, hintTokens);
    let bestConfidence = primaryConfidence;
    let usedAlternative = false;

    for (let i = 1; i < alternativesCount; i += 1) {
        const alt = resultItem[i];
        const transcript = String(alt?.transcript || '');
        if (!transcript) continue;
        const altConfidenceRaw = Number(alt?.confidence);
        const altConfidence = Number.isFinite(altConfidenceRaw) ? altConfidenceRaw : 0;
        if ((altConfidence - primaryConfidence) < SPEECH_ALT_MIN_CONFIDENCE_ADVANTAGE) {
            continue;
        }
        const score = scoreSpeechCandidateTranscript(
            transcript,
            altConfidence,
            hintTokens
        );
        if (score > (bestScore + SPEECH_ALT_MIN_SCORE_ADVANTAGE)) {
            bestScore = score;
            bestTranscript = transcript;
            bestConfidence = altConfidence;
            usedAlternative = true;
        }
    }

    return {
        transcript: bestTranscript,
        usedAlternative,
        primaryConfidence,
        chosenConfidence: bestConfidence
    };
}

function applySpeechRecognitionHints(recognitionInstance) {
    if (!recognitionInstance) return;

    const hintTokens = collectDynamicSpeechHints();
    const topTokens = Array.from(hintTokens).slice(0, SPEECH_HINT_TOKEN_LIMIT);

    const SpeechGrammarList = window.SpeechGrammarList || window.webkitSpeechGrammarList;
    if (speechGrammarHintsEnabled && SpeechGrammarList && topTokens.length) {
        try {
            const grammarTokens = topTokens
                .map((token) => token.replace(/[^a-z0-9]/g, ''))
                .filter((token) => token.length >= 2)
                .slice(0, 40);
            if (grammarTokens.length) {
                const grammar = `#JSGF V1.0; grammar wander; public <term> = ${grammarTokens.join(' | ')} ;`;
                const grammarList = new SpeechGrammarList();
                grammarList.addFromString(grammar, 1);
                recognitionInstance.grammars = grammarList;
            }
        } catch (_) {
            // no-op
        }
    }

    if (speechPhraseHintsEnabled && ('phrases' in recognitionInstance)) {
        try {
            const PhraseCtor = window.SpeechRecognitionPhrase || window.webkitSpeechRecognitionPhrase;
            const phrases = Array.from(new Set([...BASE_SPEECH_HINT_PHRASES, ...topTokens])).slice(0, SPEECH_PHRASE_HINT_LIMIT);
            recognitionInstance.phrases = phrases.map((text) => {
                if (PhraseCtor) {
                    return new PhraseCtor(text, SPEECH_PHRASE_HINT_BOOST);
                }
                return { text, boost: SPEECH_PHRASE_HINT_BOOST };
            });
        } catch (_) {
            // no-op
        }
    }
}

function primeVoiceRuntimeForPointing() {
    if (!speechEnabled || !senseVoice?.checked || !isSenseRuntimeActive()) return;

    const now = Date.now();
    if (now - lastPointingVoicePrimeAt < POINTING_VOICE_PRIME_INTERVAL_MS) return;
    lastPointingVoicePrimeAt = now;

    if (audioContext?.state === 'suspended') {
        audioContext.resume().catch(() => {
            // no-op
        });
    }

    ensureVoiceRuntimeReady().catch((error) => {
        debugLog('Pointing voice prime failed:', error?.message || error);
    });

    if (speechStatusEl && !isSpeaking) {
        applySpeechRecognitionHints(recognition);
        speechStatusEl.className = 'mic-dot listening';
    }
}

function armVoiceRetryOnNextInteraction() {
    if (voiceRetryOnInteractionArmed) return;
    voiceRetryOnInteractionArmed = true;

    const retry = async () => {
        window.removeEventListener('pointerdown', retry, true);
        window.removeEventListener('keydown', retry, true);
        voiceRetryOnInteractionArmed = false;

        if (!isSenseRuntimeActive() || !senseVoice?.checked) return;
        speechEnabled = true;
        await ensureVoiceRuntimeReady().catch((error) => {
            console.warn('Voice runtime retry after activation failed:', error.message);
        });
    };

    window.addEventListener('pointerdown', retry, true);
    window.addEventListener('keydown', retry, true);
}

function getOrCreateFreezeFrameEl(cardEl) {
    if (!cardEl) return null;
    let freezeEl = cardEl.querySelector('.video-freeze-frame');
    if (freezeEl) return freezeEl;

    const displayEl = cardEl.querySelector('.video-display');
    if (!displayEl) return null;

    freezeEl = document.createElement('img');
    freezeEl.className = 'video-freeze-frame';
    freezeEl.alt = 'Frozen frame';
    displayEl.appendChild(freezeEl);
    return freezeEl;
}

function freezeCardFrame(cardEl, videoEl) {
    if (!cardEl || !videoEl) return false;

    try {
        const width = videoEl.videoWidth || 0;
        const height = videoEl.videoHeight || 0;
        if (!width || !height) return false;

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return false;

        ctx.drawImage(videoEl, 0, 0, width, height);
        const freezeEl = getOrCreateFreezeFrameEl(cardEl);
        if (!freezeEl) return false;

        freezeEl.src = canvas.toDataURL('image/jpeg', 0.9);
        freezeEl.style.display = 'block';
        return true;
    } catch (error) {
        console.warn('Failed to freeze card frame:', error);
        return false;
    }
}

function clearCardFreezeFrame(cardEl) {
    const freezeEl = cardEl?.querySelector('.video-freeze-frame');
    if (freezeEl) {
        freezeEl.style.display = 'none';
    }
}

function hidePrimaryCardTemplate() {
    if (videoElement?.srcObject) {
        const tracks = videoElement.srcObject.getTracks?.() || [];
        tracks.forEach((track) => track.stop());
        videoElement.srcObject = null;
    }

    if (videoCard) {
        videoCard.style.display = 'none';
        videoCard.isConnected = false;
        clearCardFreezeFrame(videoCard);
    }
}

function bringCardToFront(cardEl) {
    cardZIndex += 1;
    cardEl.style.zIndex = String(cardZIndex);
    scheduleActiveProjectAutosave();
}

function applyCanvasPan() {
    if (!videoCanvas) return;
    const x = Math.round(canvasPanX);
    const y = Math.round(canvasPanY);
    videoCanvas.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    streamCards.forEach((cardState) => {
        scheduleCardChipLayout(cardState);
    });
}

function getCanvasViewportCenter() {
    const width = videoArea?.clientWidth || window.innerWidth || 0;
    const height = videoArea?.clientHeight || window.innerHeight || 0;
    return {
        x: (-canvasPanX) + (width / 2),
        y: (-canvasPanY) + (height / 2)
    };
}

function setupCanvasPanControls() {
    if (!videoArea || !videoCanvas || videoArea.dataset.panReady === 'true') return;
    videoArea.dataset.panReady = 'true';
    applyCanvasPan();

    videoArea.addEventListener('wheel', (event) => {
        if (event.ctrlKey) return;

        const interactiveTarget = event.target.closest(NON_CANVAS_POINTER_SELECTOR);
        if (interactiveTarget) return;

        event.preventDefault();
        canvasPanX -= event.deltaX * CANVAS_WHEEL_PAN_MULTIPLIER;
        canvasPanY -= event.deltaY * CANVAS_WHEEL_PAN_MULTIPLIER;
        applyCanvasPan();
        scheduleActiveProjectAutosave();
    }, { passive: false });
}

function clampCardPosition(cardEl, left, top) {
    const safeLeft = Number.isFinite(left) ? left : 0;
    const safeTop = Number.isFinite(top) ? top : 0;

    return {
        left: Math.min(Math.max(-CARD_COORD_LIMIT, safeLeft), CARD_COORD_LIMIT),
        top: Math.min(Math.max(-CARD_COORD_LIMIT, safeTop), CARD_COORD_LIMIT)
    };
}

function positionCard(cardEl, left, top) {
    const clamped = clampCardPosition(cardEl, left, top);
    cardEl.style.left = `${clamped.left}px`;
    cardEl.style.top = `${clamped.top}px`;

    const cardId = cardEl?.dataset?.cardId;
    if (cardId && streamCards.has(cardId)) {
        scheduleCardChipLayout(streamCards.get(cardId));
    }
}

function getNextCardPosition() {
    const lane = nextCardOffset % 8;
    nextCardOffset += 1;
    const center = getCanvasViewportCenter();
    return {
        left: (center.x - 240) + lane * 34,
        top: (center.y - 140) + lane * 28
    };
}

function makeCardDraggable(cardEl) {
    if (!cardEl || cardEl.dataset.dragReady === 'true') return;
    cardEl.dataset.dragReady = 'true';

    const dragHandle = cardEl;
    let dragState = null;
    const nonDraggableSelector = '.video-card-remove, .video-card-chip, .video-card-chip-minus, .card-prompt-audit, input, textarea, button, label, summary, details';

    dragHandle.addEventListener('pointerdown', (event) => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        if (event.target.closest(nonDraggableSelector)) return;

        bringCardToFront(cardEl);
        const left = parseFloat(cardEl.style.left || '0');
        const top = parseFloat(cardEl.style.top || '0');

        dragState = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            startLeft: Number.isFinite(left) ? left : 0,
            startTop: Number.isFinite(top) ? top : 0
        };

        cardEl.classList.add('dragging');
        cardEl.setPointerCapture(event.pointerId);
        event.preventDefault();
    });

    dragHandle.addEventListener('pointermove', (event) => {
        if (!dragState || event.pointerId !== dragState.pointerId) return;

        const dx = event.clientX - dragState.startX;
        const dy = event.clientY - dragState.startY;
        positionCard(cardEl, dragState.startLeft + dx, dragState.startTop + dy);
    });

    const endDrag = (event) => {
        if (!dragState || event.pointerId !== dragState.pointerId) return;
        dragState = null;
        cardEl.classList.remove('dragging');
        scheduleActiveProjectAutosave();
        try {
            cardEl.releasePointerCapture(event.pointerId);
        } catch (_) {
            // no-op
        }
    };

    dragHandle.addEventListener('pointerup', endDrag);
    dragHandle.addEventListener('pointercancel', endDrag);
}

function positionSensesPanelAboveButton() {
    if (!sensesPanel || !sensesButton) return;
    const wrapper = sensesPanel.parentElement;
    if (!wrapper) return;

    const wrapperRect = wrapper.getBoundingClientRect();
    const buttonRect = sensesButton.getBoundingClientRect();
    const panelWidth = sensesPanel.offsetWidth || 88;
    const panelHalf = panelWidth / 2;
    const safePadX = 8;
    const gap = 10;

    const centerX = buttonRect.left + (buttonRect.width / 2) - wrapperRect.left;
    let left = Math.max(panelHalf + safePadX, Math.min(centerX, wrapperRect.width - panelHalf - safePadX));
    const buttonTop = buttonRect.top - wrapperRect.top;
    const bottom = Math.max(8, (wrapperRect.height - buttonTop) + gap);

    sensesPanel.style.left = `${left}px`;
    sensesPanel.style.top = 'auto';
    sensesPanel.style.bottom = `${bottom}px`;
}

function isSensesPanelOpen() {
    return !!sensesPanel && sensesPanel.classList.contains('is-open');
}

function openSensesPanel() {
    if (!sensesPanel) return;
    showFloatingPanel(sensesPanel, 'is-open');
    sensesButton?.classList.add('active');
    requestAnimationFrame(() => {
        positionSensesPanelAboveButton();
    });
}

function closeSensesPanel() {
    if (!sensesPanel) return;
    hideFloatingPanel(sensesPanel, 'is-open');
    sensesButton?.classList.remove('active');
}

let appDomReadyInitDone = false;

async function initializeAppDomReady() {
    if (appDomReadyInitDone) return;
    appDomReadyInitDone = true;
    setThemeMode(readThemeModePreference(), { persist: false });
    setPromptBarVisibility(readPromptBarVisiblePreference(), { persist: false });
    isMinimalUiMode = readMinimalUiModePreference();
    document.body?.classList.toggle('ui-minimal-mode', isMinimalUiMode);
    if (instructionBannerEl) {
        instructionBannerEl.classList.remove('is-hidden');
        instructionBannerEl.style.display = 'flex';
        if (isMinimalUiMode) {
            scheduleInstructionBannerAutoHide();
        }
    }

    // Start each session fresh: clear persisted projects/runtime so the next load is empty.
    try {
        localStorage.removeItem(PROJECTS_STORAGE_KEY);
        localStorage.removeItem(PROJECTS_ACTIVE_STORAGE_KEY);
        localStorage.removeItem(PROJECT_RUNTIME_STORAGE_KEY);
        localStorage.removeItem(LEGACY_CONCEPTS_STORAGE_KEY);
    } catch (_) { /* ignore */ }
    loadProjects();
    setupProjectTitleInput();
    setupCanvasPanControls();
    setupOdysseyKeyGate();

    const storedOdysseyKey = localStorage.getItem('odyssey_api_key') || '';
    if (configuredOdysseyApiKey && storedOdysseyKey !== configuredOdysseyApiKey) {
        localStorage.setItem('odyssey_api_key', configuredOdysseyApiKey);
    }

    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        speechEnabled = false;
        if (senseVoice) {
            senseVoice.checked = false;
        }
    }
    debugLog('Runtime profile:', RUNTIME_PROFILE, ACTIVE_RUNTIME_TUNING);

    attachDisplayClickHandler(videoDisplay);
    hidePrimaryCardTemplate();

    if (!landingScreen) {
        const bootstrapSensesOnFirstInteraction = async () => {
            if (!appSessionActive && !isEnteringApp) {
                await launchFromLandingScreen();
            }
            if (!isSenseRuntimeActive()) return;

            const voiceWanted = !!senseVoice?.checked;
            const visionWanted = !!senseVision?.checked;
            const gesturesWanted = !!senseGestures?.checked;

            speechEnabled = voiceWanted;
            faceDetectionEnabled = visionWanted;
            handGestureEnabled = gesturesWanted;

            await warmMediaDeviceStreams({
                needMic: voiceWanted,
                needCamera: visionWanted || gesturesWanted
            }).catch((error) => {
                console.warn('Interaction media warmup failed:', error?.message || error);
            });

            if (handGestureEnabled) {
                startHandGestureTracking().catch((error) => {
                    console.warn('Hand tracking retry failed:', error.message);
                });
            }
            if (faceDetectionEnabled) {
                startFaceDetection().catch((error) => {
                    console.warn('Face detection retry failed:', error.message);
                });
            }
            if (speechEnabled) {
                ensureVoiceRuntimeReady().catch((error) => {
                    console.warn('Voice runtime retry failed:', error.message);
                });
            }

            const mediaReady = hasRequiredMediaStreamsReady({
                needMic: voiceWanted,
                needCamera: visionWanted || gesturesWanted
            });
            if (mediaReady) {
                window.removeEventListener('pointerdown', bootstrapSensesOnFirstInteraction, true);
                window.removeEventListener('keydown', bootstrapSensesOnFirstInteraction, true);
            } else {
                debugLog('Media permissions not ready yet; keeping bootstrap interaction hook active.');
            }
        };

        window.addEventListener('pointerdown', bootstrapSensesOnFirstInteraction, true);
        window.addEventListener('keydown', bootstrapSensesOnFirstInteraction, true);

        // With no landing screen, bootstrap the app immediately.
        // First interaction listeners above still retry senses when browsers gate media/speech until activation.
        if (hasOdysseyConnectionAccess()) {
            hideOdysseyKeyGate();
            await launchFromLandingScreen();
        } else {
            showOdysseyKeyGate();
        }
    }
}

if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', () => {
        initializeAppDomReady().catch((error) => {
            console.error('App initialization failed:', error);
        });
    }, { once: true });
} else {
    initializeAppDomReady().catch((error) => {
        console.error('App initialization failed:', error);
    });
}

window.addEventListener('resize', () => {
    if (videoCard && videoCard.isConnected) {
        const left = parseFloat(videoCard.style.left || '0');
        const top = parseFloat(videoCard.style.top || '0');
        positionCard(videoCard, Number.isFinite(left) ? left : 0, Number.isFinite(top) ? top : 0);
    }

    streamCards.forEach((cardState) => {
        if (!cardState.cardEl) return;
        const left = parseFloat(cardState.cardEl.style.left || '0');
        const top = parseFloat(cardState.cardEl.style.top || '0');
        positionCard(
            cardState.cardEl,
            Number.isFinite(left) ? left : 0,
            Number.isFinite(top) ? top : 0
        );
    });

    if (isSensesPanelOpen()) {
        positionSensesPanelAboveButton();
    }
});

async function launchFromLandingScreen() {
    if (isEnteringApp || isConnected) return;
    isEnteringApp = true;
    try {
        await enterAppFromLanding();
    } finally {
        isEnteringApp = false;
    }
}

// Click anywhere on landing screen to enter
if (landingScreen) {
    landingScreen.addEventListener('click', async () => {
        await launchFromLandingScreen();
    });

    landingScreen.addEventListener('keydown', async (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        await launchFromLandingScreen();
    });
}

// Senses button toggle
sensesButton.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isSensesPanelOpen()) {
        closeSensesPanel();
        return;
    }
    openSensesPanel();
});

// Close senses panel when clicking outside
document.addEventListener('click', (e) => {
    const clickedSensesButton = e.target.closest('#sensesButton');
    if (!sensesPanel.contains(e.target) && !clickedSensesButton) {
        closeSensesPanel();
    }
});

let promptSpawnInFlight = false;

async function freezeAndStopPrimaryStream() {
    if (!odysseyClient && !isStreaming) return;

    freezeCardFrame(videoCard, videoElement);
    suppressPrimaryAutoRestart = !!isStreaming;

    try {
        if (isStreaming && odysseyClient) {
            await odysseyClient.endStream();
        }
    } catch (error) {
        console.warn('Primary endStream error:', error);
    }

    try {
        odysseyClient?.disconnect();
    } catch (error) {
        console.warn('Primary disconnect error:', error);
    }
    odysseyClient = null;

    if (recognition) {
        try {
            recognition.stop();
        } catch (_) {
            // no-op
        }
    }

    if (videoElement?.srcObject) {
        const tracks = videoElement.srcObject.getTracks?.() || [];
        tracks.forEach((track) => track.stop());
        videoElement.srcObject = null;
    }

    isStreaming = false;
    isConnected = false;
    setSidebarStreamStatus('Frozen');
    if (videoCardStatus) {
        videoCardStatus.textContent = 'Frozen';
        videoCardStatus.className = 'status-badge';
    }
    setActiveStream(null, null);
}

async function freezeAndStopSecondaryCard(cardId, options = {}) {
    const { trackProjectChange = true } = options;
    const cardState = streamCards.get(cardId);
    if (!cardState) return;
    cardState.replayFallbackDisabled = true;

    const freezeSourceVideo = cardState.replayActive && cardState.replayVideoEl
        ? cardState.replayVideoEl
        : cardState.videoEl;

    await stopCardReplayRecorder(cardState, { keepChunks: false });

    cardState.isFrozen = true;
    freezeCardFrame(cardState.cardEl, freezeSourceVideo);
    clearCardReplayLoop(cardState, { revokeBlobUrl: true, immediate: true });
    setCardStatusText(cardState, 'Frozen');

    try {
        if (cardState.isStreaming && cardState.client) {
            await cardState.client.endStream();
        }
    } catch (error) {
        console.warn('Secondary endStream error:', error);
    }

    try {
        cardState.client?.disconnect();
    } catch (error) {
        console.warn('Secondary disconnect error:', error);
    }
    cardState.client = null;

    if (cardState.videoEl?.srcObject) {
        const tracks = cardState.videoEl.srcObject.getTracks?.() || [];
        tracks.forEach((track) => track.stop());
        cardState.videoEl.srcObject = null;
    }

    cardState.isStreaming = false;
    cardState.isConnected = false;
    cardState.replayActive = false;
    setCardStatusText(cardState, 'Frozen');
    if (activeStreamType === 'secondary' && activeStreamCardId === cardId) {
        setActiveStream(null, null);
    }
    if (trackProjectChange) {
        scheduleActiveProjectAutosave();
    }
}

async function freezeAndStopActiveStream() {
    if (activeStreamType === 'primary') {
        await freezeAndStopPrimaryStream();
        return;
    }

    if (activeStreamType === 'secondary' && activeStreamCardId) {
        await freezeAndStopSecondaryCard(activeStreamCardId);
        return;
    }

    // Fallback: if active tracking is out of sync but primary is still alive,
    // stop it before creating the next card stream.
    if (odysseyClient || isConnected || isStreaming) {
        await freezeAndStopPrimaryStream();
    }
}

function isOdysseyConcurrentSessionError(error) {
    const message = String(error?.message || error || '').toLowerCase();
    if (message.includes('maximum concurrent sessions')) return true;
    if (message.includes('concurrent sessions')) return true;
    if (message.includes('status 429')) return true;
    if (message.includes(' 429')) return true;
    return false;
}

function isOdysseyStreamDurationLimitError(reason, message) {
    const combined = `${reason || ''} ${message || ''}`.toLowerCase();
    return (
        combined.includes('session_timeout') ||
        combined.includes('credit lease expired') ||
        combined.includes('stream duration') ||
        combined.includes('duration limit')
    );
}

function delayMs(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function isReplayRecorderSupported() {
    return typeof MediaRecorder !== 'undefined';
}

function getSupportedReplayRecorderMimeType() {
    if (!isReplayRecorderSupported() || typeof MediaRecorder.isTypeSupported !== 'function') {
        return '';
    }

    for (const mimeType of REPLAY_RECORDER_MIME_TYPES) {
        try {
            if (MediaRecorder.isTypeSupported(mimeType)) {
                return mimeType;
            }
        } catch (_) {
            // Continue probing fallback MIME types.
        }
    }

    return '';
}

function pruneCardReplayChunks(cardState, nowTs = Date.now()) {
    if (!cardState) return;
    if (!Array.isArray(cardState.replayChunks) || !cardState.replayChunks.length) {
        cardState.replayChunks = [];
        return;
    }

    const cutoffTs = nowTs - REPLAY_CHUNK_RETENTION_MS;
    cardState.replayChunks = cardState.replayChunks.filter((entry) => {
        if (!entry?.blob || !entry.blob.size) return false;
        const entryTs = Number.isFinite(entry.ts) ? entry.ts : 0;
        return entryTs >= cutoffTs;
    });
}

function stopCardReplayCaptureStream(cardState) {
    const captureStream = cardState?.replayCaptureStream;
    if (captureStream?.getTracks) {
        const tracks = captureStream.getTracks();
        tracks.forEach((track) => {
            try {
                track.stop();
            } catch (_) {
                // no-op
            }
        });
    }
    if (cardState) {
        cardState.replayCaptureStream = null;
    }
}

async function stopCardReplayRecorder(cardState, options = {}) {
    if (!cardState) return;

    const keepChunks = options.keepChunks !== false;
    const recorder = cardState.replayRecorder;
    cardState.replayRecorder = null;

    if (!recorder) {
        stopCardReplayCaptureStream(cardState);
        if (!keepChunks) {
            cardState.replayChunks = [];
        }
        return;
    }

    const state = String(recorder.state || '').toLowerCase();
    if (state !== 'inactive') {
        await new Promise((resolve) => {
            let settled = false;
            const done = () => {
                if (settled) return;
                settled = true;
                resolve();
            };

            const timeoutId = setTimeout(done, REPLAY_RECORDER_STOP_TIMEOUT_MS);
            const finish = () => {
                clearTimeout(timeoutId);
                done();
            };

            try {
                recorder.addEventListener('stop', finish, { once: true });
                recorder.addEventListener('error', finish, { once: true });
                recorder.stop();
            } catch (_) {
                finish();
            }
        });
    }

    stopCardReplayCaptureStream(cardState);
    pruneCardReplayChunks(cardState);
    if (!keepChunks) {
        cardState.replayChunks = [];
    }
}

function getOrCreateCardReplayVideoEl(cardState) {
    if (!cardState) return null;

    const existing = cardState.replayVideoEl || cardState.displayEl?.querySelector('.video-replay-loop');
    if (existing) {
        cardState.replayVideoEl = existing;
        return existing;
    }

    const displayEl = cardState.displayEl || cardState.cardEl?.querySelector('.video-display');
    if (!displayEl) return null;

    const replayVideoEl = document.createElement('video');
    replayVideoEl.className = 'video-replay-loop';
    replayVideoEl.muted = true;
    replayVideoEl.autoplay = true;
    replayVideoEl.loop = true;
    replayVideoEl.playsInline = true;
    replayVideoEl.setAttribute('aria-label', 'Replay loop');

    const anchor = displayEl.querySelector('.card-center-loading');
    if (anchor) {
        displayEl.insertBefore(replayVideoEl, anchor);
    } else {
        displayEl.appendChild(replayVideoEl);
    }

    cardState.replayVideoEl = replayVideoEl;
    return replayVideoEl;
}

function clearCardReplayLoop(cardState, options = {}) {
    if (!cardState) return;
    const revokeBlobUrl = options.revokeBlobUrl === true;
    const immediate = options.immediate === true;
    const replayVideoEl = cardState.replayVideoEl || cardState.displayEl?.querySelector('.video-replay-loop');
    if (replayVideoEl) {
        cardState.replayVideoEl = replayVideoEl;
    }

    if (replayVideoEl) {
        if (cardState.replayHideTimer) {
            clearTimeout(cardState.replayHideTimer);
            cardState.replayHideTimer = null;
        }
        replayVideoEl.classList.remove('is-active');
        const clearVideo = () => {
            if (replayVideoEl.classList.contains('is-active')) return;
            replayVideoEl.pause();
            replayVideoEl.style.display = 'none';
            replayVideoEl.removeAttribute('src');
            try {
                replayVideoEl.load();
            } catch (_) {
                // no-op
            }
        };
        if (immediate) {
            clearVideo();
        } else {
            cardState.replayHideTimer = setTimeout(() => {
                cardState.replayHideTimer = null;
                clearVideo();
            }, REPLAY_CROSSFADE_MS);
        }
    }

    if (revokeBlobUrl && cardState.replayBlobUrl) {
        const previousBlobUrl = cardState.replayBlobUrl;
        cardState.replayBlobUrl = '';
        const revoke = () => URL.revokeObjectURL(previousBlobUrl);
        if (immediate) {
            revoke();
        } else {
            setTimeout(revoke, REPLAY_CROSSFADE_MS + 40);
        }
    }

    cardState.replayActive = false;
}

function buildReplayClipBlob(cardState) {
    if (!cardState || !Array.isArray(cardState.replayChunks) || !cardState.replayChunks.length) {
        return null;
    }

    const newestTs = Number.isFinite(cardState.replayChunks[cardState.replayChunks.length - 1]?.ts)
        ? cardState.replayChunks[cardState.replayChunks.length - 1].ts
        : Date.now();
    const clipCutoffTs = newestTs - REPLAY_LOOP_WINDOW_MS;
    const selectedChunks = cardState.replayChunks
        .filter((entry) => Number.isFinite(entry?.ts) && entry.ts >= clipCutoffTs)
        .map((entry) => entry.blob)
        .filter((blob) => blob instanceof Blob && blob.size > 0);

    const clipChunks = selectedChunks.length
        ? selectedChunks
        : cardState.replayChunks
            .slice(-Math.max(1, Math.ceil(REPLAY_LOOP_WINDOW_MS / REPLAY_TIMESLICE_MS)))
            .map((entry) => entry?.blob)
            .filter((blob) => blob instanceof Blob && blob.size > 0);

    if (!clipChunks.length) {
        return null;
    }

    const blobType = clipChunks.find((blob) => blob.type)?.type || 'video/webm';
    return new Blob(clipChunks, { type: blobType });
}

function activateCardReplayLoop(cardState, replayBlob) {
    if (!cardState || !(replayBlob instanceof Blob) || replayBlob.size <= 0) {
        return false;
    }

    const replayVideoEl = getOrCreateCardReplayVideoEl(cardState);
    if (!replayVideoEl) {
        return false;
    }

    clearCardReplayLoop(cardState, { revokeBlobUrl: true, immediate: true });
    clearCardFreezeFrame(cardState.cardEl);

    cardState.replayBlobUrl = URL.createObjectURL(replayBlob);
    replayVideoEl.src = cardState.replayBlobUrl;
    replayVideoEl.muted = true;
    replayVideoEl.autoplay = true;
    replayVideoEl.loop = true;
    replayVideoEl.playsInline = true;
    replayVideoEl.style.display = 'block';
    requestAnimationFrame(() => {
        replayVideoEl.classList.add('is-active');
    });
    replayVideoEl.play().catch(() => {
        // Autoplay is best effort; muted + loop still works after user interaction.
    });

    cardState.replayActive = true;
    cardState.isFrozen = false;
    recordStreamTelemetry('replay_activated', { cardId: cardState.id, bytes: replayBlob.size });
    return true;
}

async function startCardReplayRecorder(cardState, mediaStream, options = {}) {
    if (!cardState) return false;

    const preserveActiveReplay = options.preserveActiveReplay === true && cardState.replayActive;
    await stopCardReplayRecorder(cardState, { keepChunks: false });
    if (!preserveActiveReplay) {
        clearCardReplayLoop(cardState, { revokeBlobUrl: true, immediate: true });
    }
    cardState.replayChunks = [];
    cardState.replaySupported = isReplayRecorderSupported();
    if (!cardState.replaySupported) {
        recordStreamTelemetry('replay_recorder_unsupported', { cardId: cardState.id });
        return false;
    }

    const videoTracks = mediaStream?.getVideoTracks?.() || [];
    if (!videoTracks.length) {
        return false;
    }

    let recorder = null;
    const replayVideoTrack = videoTracks[0].clone();
    const captureStream = new MediaStream([replayVideoTrack]);
    const mimeType = getSupportedReplayRecorderMimeType();

    try {
        const recorderOptions = mimeType ? { mimeType } : undefined;
        recorder = new MediaRecorder(captureStream, recorderOptions);
    } catch (error) {
        console.warn('Replay recorder init failed; falling back to freeze frame for demotion.', error);
        cardState.replaySupported = false;
        const tracks = captureStream.getTracks?.() || [];
        tracks.forEach((track) => {
            try {
                track.stop();
            } catch (_) {
                // no-op
            }
        });
        return false;
    }

    cardState.replayCaptureStream = captureStream;
    cardState.replayRecorder = recorder;

    recorder.addEventListener('dataavailable', (event) => {
        if (!(event?.data instanceof Blob) || event.data.size <= 0) return;
        cardState.replayChunks.push({
            blob: event.data,
            ts: Date.now()
        });
        pruneCardReplayChunks(cardState);
    });

    recorder.addEventListener('error', (event) => {
        const detail = event?.error || event;
        console.warn(`Replay recorder error for ${cardState.id}:`, detail);
    });

    try {
        recorder.start(REPLAY_TIMESLICE_MS);
        return true;
    } catch (error) {
        console.warn(`Replay recorder start failed for ${cardState.id}:`, error);
        cardState.replaySupported = false;
        cardState.replayRecorder = null;
        stopCardReplayCaptureStream(cardState);
        return false;
    }
}

async function demoteCardToReplay(cardState, options = {}) {
    const trackProjectChange = options.trackProjectChange === true;
    const reason = String(options.reason || 'fallback');
    if (!cardState?.id || !streamCards.has(cardState.id)) {
        return false;
    }
    cardState.replayFallbackDisabled = true;

    const demotedCardId = cardState.id;
    const freezeSourceVideo = cardState.videoEl;
    let replayActivated = false;
    const freezeCaptured = freezeCardFrame(cardState.cardEl, freezeSourceVideo);
    recordStreamTelemetry('card_demote_to_replay', { cardId: demotedCardId, reason });

    try {
        await stopCardReplayRecorder(cardState, { keepChunks: true });
        pruneCardReplayChunks(cardState);
        const replayBlob = buildReplayClipBlob(cardState);
        if (replayBlob) {
            replayActivated = activateCardReplayLoop(cardState, replayBlob);
        }
    } catch (error) {
        console.warn(`Replay demotion prep failed for ${demotedCardId}:`, error);
    }

    if (!streamCards.has(demotedCardId)) {
        return false;
    }

    if (!replayActivated) {
        clearCardReplayLoop(cardState, { revokeBlobUrl: true, immediate: true });
        cardState.isFrozen = freezeCaptured || freezeCardFrame(cardState.cardEl, freezeSourceVideo);
        recordStreamTelemetry('replay_fallback_frozen', { cardId: demotedCardId, reason });
    }

    try {
        if (cardState.isStreaming && cardState.client) {
            await cardState.client.endStream();
        }
    } catch (error) {
        console.warn(`Replay demotion endStream error for ${demotedCardId}:`, error);
    }

    try {
        cardState.client?.disconnect();
    } catch (error) {
        console.warn(`Replay demotion disconnect error for ${demotedCardId}:`, error);
    }
    cardState.client = null;

    if (cardState.videoEl?.srcObject) {
        const tracks = cardState.videoEl.srcObject.getTracks?.() || [];
        tracks.forEach((track) => track.stop());
        cardState.videoEl.srcObject = null;
    }

    if (!streamCards.has(demotedCardId)) {
        return false;
    }

    cardState.isConnected = false;
    cardState.isStreaming = false;

    if (replayActivated) {
        cardState.isFrozen = false;
        setCardStatusText(cardState, reason === 'concurrent-limit' ? 'Replay - live limit reached' : 'Replay');
    } else {
        cardState.replayActive = false;
        setCardStatusText(cardState, cardState.isFrozen ? 'Frozen' : 'Stopped');
    }

    if (activeStreamType === 'secondary' && activeStreamCardId === demotedCardId) {
        setActiveStream(null, null);
    }
    if (trackProjectChange) {
        scheduleActiveProjectAutosave();
    }
    return true;
}

function setSecondaryCardEndedStatus(cardState) {
    if (!cardState?.id || !streamCards.has(cardState.id)) return;
    if (cardState.replayActive) {
        setCardStatusText(cardState, 'Replay');
        return;
    }
    if (cardState.isFrozen) {
        setCardStatusText(cardState, 'Frozen');
        return;
    }
    setCardStatusText(cardState, 'Stopped');
}

function handleSecondaryCardStreamEnded(cardState) {
    if (!cardState?.id || !streamCards.has(cardState.id)) return;
    cardState.isStreaming = false;
    if (cardState.recoveryInFlight) return;

    if (cardState.replayFallbackDisabled) {
        const currentStatus = normalizeCardStatusText(
            cardState.statusEl?.getAttribute('aria-label') || cardState.statusEl?.title || ''
        ).toLowerCase();
        if (/^(resuming|connecting|retrying|prompting|applying)\b/.test(currentStatus)) {
            return;
        }
        setSecondaryCardEndedStatus(cardState);
        return;
    }

    if (cardState.replayActive || cardState.isFrozen) {
        setSecondaryCardEndedStatus(cardState);
        return;
    }

    cardState.replayFallbackDisabled = true;
    void demoteCardToReplay(cardState, { trackProjectChange: true, reason: 'stream-ended' })
        .catch((error) => {
            console.warn(`Replay fallback on stream end failed for ${cardState.id}:`, error);
            setSecondaryCardEndedStatus(cardState);
        });
}

function handleSecondaryCardStreamError(cardState, reason, message) {
    if (!cardState?.id || !streamCards.has(cardState.id)) return;
    const normalizedReason = String(reason || 'stream_error');
    const normalizedMessage = String(message || '').trim();
    recordStreamTelemetry('card_stream_error', {
        cardId: cardState.id,
        reason: normalizedReason,
        message: normalizedMessage
    });

    if (isOdysseyStreamDurationLimitError(normalizedReason, normalizedMessage)) {
        void recoverCardFromStreamDurationLimit(cardState, normalizedReason, normalizedMessage);
        return;
    }

    setCardStatusText(cardState, 'Error');
}

async function recoverCardFromStreamDurationLimit(cardState, reason = 'session_timeout', message = '') {
    if (!cardState?.id || !streamCards.has(cardState.id)) return false;
    if (cardState.recoveryInFlight) return false;

    cardState.recoveryInFlight = true;
    recordStreamTelemetry('card_duration_recovery_start', {
        cardId: cardState.id,
        reason,
        message
    });
    setCardStatusText(cardState, 'Timed out');

    try {
        await demoteCardToReplay(cardState, { trackProjectChange: true, reason: 'duration-limit' });
        if (!streamCards.has(cardState.id)) return false;
        setCardStatusText(cardState, cardState.replayActive ? 'Recovering...' : 'Resuming...');
        await delayMs(500);
        await restartStreamCard(cardState, { preserveReplayUntilLive: true, reason: 'duration-limit' });
        recordStreamTelemetry('card_duration_recovery_success', { cardId: cardState.id });
        return true;
    } catch (error) {
        console.warn(`Duration recovery failed for ${cardState.id}:`, error);
        recordStreamTelemetry('card_duration_recovery_error', {
            cardId: cardState.id,
            message: error?.message || String(error || '')
        });
        setSecondaryCardEndedStatus(cardState);
        return false;
    } finally {
        cardState.recoveryInFlight = false;
    }
}

function getLeastRecentlyInteractedLiveCard(excludeCardId = null) {
    const liveCards = [];
    for (const [cardId, cardState] of streamCards.entries()) {
        if (!cardState || (excludeCardId && cardId === excludeCardId)) continue;
        if (cardState.replayActive) continue;
        if (!(cardState.isStreaming || cardState.isConnected)) continue;

        liveCards.push(cardState);
    }

    if (!liveCards.length) {
        return null;
    }

    liveCards.sort((left, right) => {
        const leftInteracted = Number.isFinite(left.lastInteractedAt) ? left.lastInteractedAt : 0;
        const rightInteracted = Number.isFinite(right.lastInteractedAt) ? right.lastInteractedAt : 0;
        if (leftInteracted !== rightInteracted) {
            return leftInteracted - rightInteracted;
        }

        const leftCreated = Number.isFinite(left.createdAt) ? left.createdAt : 0;
        const rightCreated = Number.isFinite(right.createdAt) ? right.createdAt : 0;
        return leftCreated - rightCreated;
    });

    return liveCards[0] || null;
}

async function demoteLeastRecentLiveCardForConcurrentLimit(excludeCardId = null) {
    const candidate = getLeastRecentlyInteractedLiveCard(excludeCardId);
    if (!candidate) {
        return false;
    }

    console.warn(`Concurrent limit fallback: demoting ${candidate.id} to replay.`);
    setCardStatusText(candidate, 'Replay fallback...');
    return demoteCardToReplay(candidate, { trackProjectChange: false, reason: 'concurrent-limit' });
}

async function forceCloseAllOdysseySessions(options = {}) {
    const excludeCardId = options.excludeCardId || null;
    const trackProjectChange = options.trackProjectChange !== false;

    if (odysseyClient || isConnected || isStreaming) {
        await freezeAndStopPrimaryStream();
    }

    for (const [cardId, cardState] of streamCards.entries()) {
        if (excludeCardId && cardId === excludeCardId) continue;
        if (!cardState) continue;

        if (cardState.client || cardState.isStreaming || cardState.isConnected) {
            await freezeAndStopSecondaryCard(cardId, { trackProjectChange });
        }
    }
}

async function connectCardClientWithRetry(cardState, apiKey, connectOptions) {
    let lastError = null;

    for (let attempt = 1; attempt <= ODYSSEY_CONNECT_MAX_ATTEMPTS; attempt += 1) {
        const client = apiKey ? new window.Odyssey({ apiKey }) : new window.Odyssey();
        cardState.client = client;
        try {
            setCardStatusText(cardState, apiKey ? 'Connecting...' : 'Credentials...');
            recordStreamTelemetry('card_connect_attempt', {
                cardId: cardState.id,
                attempt,
                mode: apiKey ? 'local-key' : 'credentials'
            });
            const credentials = apiKey ? null : await fetchOdysseyClientCredentials();
            setCardStatusText(cardState, 'Connecting...');
            const mediaStream = credentials
                ? await client.connectWithCredentials(credentials, connectOptions)
                : await client.connect(connectOptions);
            recordStreamTelemetry('card_connect_success', { cardId: cardState.id, attempt });
            return { client, mediaStream };
        } catch (error) {
            lastError = error;
            recordStreamTelemetry('card_connect_error', {
                cardId: cardState.id,
                attempt,
                message: error?.message || String(error || '')
            });
            try {
                client.disconnect();
            } catch (_) {
                // no-op
            }
            if (cardState.client === client) {
                cardState.client = null;
            }

            if (!isOdysseyConcurrentSessionError(error) || attempt >= ODYSSEY_CONNECT_MAX_ATTEMPTS) {
                break;
            }

            console.warn(`Odyssey session limit reached. Retrying connect (${attempt}/${ODYSSEY_CONNECT_MAX_ATTEMPTS})...`);
            setCardStatusText(cardState, 'Retrying...');
            const demoted = await demoteLeastRecentLiveCardForConcurrentLimit(cardState.id);
            if (!demoted) {
                console.warn('No demotable live card found; force-closing Odyssey sessions as emergency fallback.');
                await forceCloseAllOdysseySessions({ excludeCardId: cardState.id, trackProjectChange: false });
            }
            await delayMs(ODYSSEY_CONNECT_RETRY_DELAY_MS);
        }
    }

    if (isOdysseyConcurrentSessionError(lastError)) {
        console.warn('Concurrent retries exhausted; force-closing Odyssey sessions before final connect attempt.');
        await forceCloseAllOdysseySessions({ excludeCardId: cardState.id, trackProjectChange: false });
        const emergencyClient = apiKey ? new window.Odyssey({ apiKey }) : new window.Odyssey();
        cardState.client = emergencyClient;
        try {
            setCardStatusText(cardState, apiKey ? 'Connecting...' : 'Credentials...');
            recordStreamTelemetry('card_connect_emergency_attempt', {
                cardId: cardState.id,
                mode: apiKey ? 'local-key' : 'credentials'
            });
            const credentials = apiKey ? null : await fetchOdysseyClientCredentials();
            setCardStatusText(cardState, 'Connecting...');
            const mediaStream = credentials
                ? await emergencyClient.connectWithCredentials(credentials, connectOptions)
                : await emergencyClient.connect(connectOptions);
            recordStreamTelemetry('card_connect_emergency_success', { cardId: cardState.id });
            return { client: emergencyClient, mediaStream };
        } catch (error) {
            lastError = error;
            recordStreamTelemetry('card_connect_emergency_error', {
                cardId: cardState.id,
                message: error?.message || String(error || '')
            });
            try {
                emergencyClient.disconnect();
            } catch (_) {
                // no-op
            }
            if (cardState.client === emergencyClient) {
                cardState.client = null;
            }
        }
    }

    throw lastError || new Error('Failed to connect stream card');
}

async function submitPromptAsNewCard(rawText, options = {}) {
    const text = (rawText || '').trim();
    if (!text || promptSpawnInFlight) return;

    promptSpawnInFlight = true;
    try {
        return await createStreamCardFromPrompt(text, options);
    } finally {
        promptSpawnInFlight = false;
    }
}

// Send button creates a new streaming card.
sendButton.addEventListener('click', async () => {
    const text = promptInput.value.trim();
    if (!text) return;

    promptInput.value = '';
    await submitPromptAsNewCard(text);
});

// Enter key sends prompt as a shortcut.
promptInput.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();

    const text = promptInput.value.trim();
    if (!text) return;

    promptInput.value = '';
    await submitPromptAsNewCard(text);
});

// Legacy primary-card remove button (template removed).
if (removeVideoCardBtn) {
    removeVideoCardBtn.addEventListener('click', async () => {
        await removePrimaryCard();
    });
}

// Sidebar toggle - show on hover
const sidebarToggle = document.getElementById('sidebarToggle');
const debugSidebar = document.getElementById('debugSidebar');
const sidebarPinBtn = document.getElementById('sidebarPin');
let sidebarPinned = false;

function setSidebarPinnedState(isPinned) {
    sidebarPinned = Boolean(isPinned);

    if (debugSidebar) {
        debugSidebar.classList.toggle('open', sidebarPinned);
        if (sidebarPinned) {
            debugSidebar.classList.add('visible');
        } else {
            debugSidebar.classList.remove('visible');
        }
    }

    if (sidebarPinBtn) {
        sidebarPinBtn.classList.toggle('is-pinned', sidebarPinned);
        sidebarPinBtn.setAttribute('aria-pressed', sidebarPinned ? 'true' : 'false');
        sidebarPinBtn.title = sidebarPinned ? 'Unpin workspace panel' : 'Pin workspace panel';
        sidebarPinBtn.setAttribute('aria-label', sidebarPinned ? 'Unpin workspace panel' : 'Pin workspace panel');
    }
}

if (sidebarToggle && debugSidebar) {
    sidebarToggle.addEventListener('click', () => {
        if (sidebarPinned) return;
        debugSidebar.classList.toggle('visible');
    });
}

if (sidebarPinBtn) {
    sidebarPinBtn.addEventListener('click', () => {
        setSidebarPinnedState(!sidebarPinned);
    });
}

setSidebarPinnedState(false);

// ==================== ONBOARDING HINTS ====================

const onboarding = {
    hasCreatedCard: false,
    hasPointedAtCard: false,
    hasPinchedToMove: false,
};

function dismissHint(id) {
    const el = document.getElementById(id);
    if (!el || el.classList.contains('onboarding-hint--hidden')) return;
    el.classList.add('onboarding-hint--dismissing');
    setTimeout(() => {
        el.classList.add('onboarding-hint--hidden');
        el.classList.remove('onboarding-hint--dismissing');
    }, 320);
}

function showHint(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('onboarding-hint--hidden', 'onboarding-hint--dismissing');
}

function onFirstCardCreated() {
    if (onboarding.hasCreatedCard) return;
    onboarding.hasCreatedCard = true;
    dismissHint('hintCreate');
    setTimeout(() => {
        if (!onboarding.hasPointedAtCard) showHint('hintEdit');
        if (!onboarding.hasPinchedToMove) showHint('hintMove');
    }, 600);
}

function onPointedAtCard() {
    if (onboarding.hasPointedAtCard) return;
    onboarding.hasPointedAtCard = true;
    dismissHint('hintEdit');
}

function onPinchedToMove() {
    if (onboarding.hasPinchedToMove) return;
    onboarding.hasPinchedToMove = true;
    dismissHint('hintMove');
}

if (newProjectTopBtn) {
    newProjectTopBtn.addEventListener('click', async () => {
        await createAndActivateNewProject();
    });
}

if (newProjectConceptBtn) {
    newProjectConceptBtn.addEventListener('click', async () => {
        await createAndActivateNewProject();
    });
}

if (instructionCloseBtn && instructionBannerEl) {
    instructionCloseBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        instructionBannerHiddenForSession = true;
        setInstructionBannerHidden(true);
    });
}

if (optionPromptBarToggleEl) {
    optionPromptBarToggleEl.addEventListener('change', (event) => {
        setPromptBarVisibility(!!event.target.checked);
    });
}

if (optionThemeToggleEl) {
    optionThemeToggleEl.addEventListener('change', (event) => {
        setThemeMode(event.target.checked ? 'dark' : 'light');
    });
}

if (wanderWelcomeCloseBtn) {
    wanderWelcomeCloseBtn.addEventListener('click', hideWelcomeModal);
}

if (wanderWelcomeModalEl) {
    wanderWelcomeModalEl.addEventListener('click', (event) => {
        if (event.target === wanderWelcomeModalEl) {
            hideWelcomeModal();
        }
    });
}

if (optionWelcomeReplayBtn) {
    optionWelcomeReplayBtn.addEventListener('click', () => {
        showWelcomeModal({ force: true });
    });
}

window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && wanderWelcomeModalEl && !wanderWelcomeModalEl.hidden) {
        hideWelcomeModal();
    }
});

// Sense toggles
senseVoice.addEventListener('change', (e) => {
    speechEnabled = e.target.checked;
    if (speechEnabled) {
        if (audioContext?.state === 'suspended') {
            audioContext.resume().catch(() => {
                // no-op
            });
        }
        if (analyser && !audioAnalysisFrameId && !audioAnalysisTimeoutId) {
            analyzeAudioContinuously();
        }
        ensureVoiceRuntimeReady().catch((error) => {
            console.warn('Voice runtime start failed:', error.message);
        });
    } else if (!speechEnabled && recognition) {
        recognition.stop();
        if (audioContext?.state === 'running') {
            audioContext.suspend().catch(() => {
                // no-op
            });
        }
        stopAudioAnalysisLoop();
    }
    debugLog('Voice sense:', speechEnabled ? 'enabled' : 'disabled');
});

senseVision.addEventListener('change', (e) => {
    faceDetectionEnabled = e.target.checked;
    if (!faceDetectionEnabled) {
        if (faceDetectionInterval) {
            clearTimeout(faceDetectionInterval);
            faceDetectionInterval = null;
        }
        const faceCtx = faceCanvas?.getContext?.('2d');
        if (faceCtx) faceCtx.clearRect(0, 0, faceCanvas.width, faceCanvas.height);
        currentEmotion = 'neutral';
        emotionConfidence = 0;
        if (emotionValueEl) emotionValueEl.textContent = 'neutral';
        if (emotionEmojiEl) emotionEmojiEl.textContent = ':|';
        applyEmotionColors('neutral');
        if (emotionLabelEl) emotionLabelEl.textContent = 'neutral';
        if (emotionPercentEl) emotionPercentEl.textContent = '0%';
    } else if (isSenseRuntimeActive()) {
        startFaceDetection().catch((error) => {
            console.warn('Face detection start failed:', error.message);
        });
    }
    console.log('Vision sense:', faceDetectionEnabled ? 'enabled' : 'disabled');
});

senseGestures.addEventListener('change', (e) => {
    handGestureEnabled = e.target.checked;
    if (!handGestureEnabled) {
        clearPointingGestureState();
        endPinchDrag();
        handMissedFrames = 0;
        lastCameraRecoveryAttempt = 0;
        lastHandTrackerFatalAt = 0;
        handTrackerRecovering = false;
        handTrackingStartInFlight = false;
        currentGesture = null;
        hideInactiveFingerCursors(null);
        stopHandTrackingLoop();
        closeHandsRuntime().catch(() => {
            // no-op
        });
        const ctx = handCanvas?.getContext?.('2d');
        if (ctx) ctx.clearRect(0, 0, handCanvas.width, handCanvas.height);
    } else if (isSenseRuntimeActive()) {
        startHandGestureTracking().catch((error) => {
            console.warn('Hand tracking start failed:', error.message);
        });
    }
    console.log('Gestures sense:', handGestureEnabled ? 'enabled' : 'disabled');
});

async function generatePromptForCard(userText) {
    const text = (userText || '').trim();
    if (!text) return '';
    if (!hasOpenAiTransport()) return text;

    try {
        const data = await requestOpenAiChatCompletions({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: 'Rewrite user input into a concise Odyssey visual prompt. Keep meaning unchanged. Output only the prompt.'
                },
                {
                    role: 'user',
                    content: text
                }
            ],
            max_tokens: 80,
            temperature: 0.25
        });
        const generated = data?.choices?.[0]?.message?.content?.trim();
        return generated || text;
    } catch (error) {
        if (!isAbortError(error)) {
            console.error('OpenAI prompt generation failed:', error);
        }
        return text;
    }
}

async function stopAndRemoveStreamCard(cardId) {
    const cardState = streamCards.get(cardId);
    if (!cardState) return;
    recordStreamTelemetry('card_remove_start', { cardId });
    cardState.replayFallbackDisabled = true;

    const layoutRafId = cardChipLayoutRaf.get(cardId);
    if (layoutRafId) {
        cancelAnimationFrame(layoutRafId);
        cardChipLayoutRaf.delete(cardId);
    }

    await stopCardReplayRecorder(cardState, { keepChunks: false });
    clearCardReplayLoop(cardState, { revokeBlobUrl: true, immediate: true });

    streamCards.delete(cardId);
    if (activeStreamType === 'secondary' && activeStreamCardId === cardId) {
        setActiveStream(null, null);
    }
    cardState.cardEl?.remove();

    try {
        if (cardState.isStreaming && cardState.client) {
            await cardState.client.endStream();
        }
    } catch (error) {
        console.warn('Card endStream error:', error);
    }

    try {
        if (cardState.client) {
            cardState.client.disconnect();
        }
    } catch (error) {
        console.warn('Card disconnect error:', error);
    }
    cardState.client = null;

    try {
        if (cardState.videoEl && cardState.videoEl.srcObject) {
            const tracks = cardState.videoEl.srcObject.getTracks?.() || [];
            tracks.forEach((track) => track.stop());
            cardState.videoEl.srcObject = null;
        }
    } catch (error) {
        console.warn('Card media cleanup error:', error);
    }
    cardState.replayActive = false;

    if (hoverPointerCardId === cardId) {
        hoverPointerCardId = null;
    }
    if (lastClickTargetCardId === cardId) {
        lastClickTargetCardId = null;
    }
    if (pinchDragState?.cardId === cardId) {
        endPinchDrag();
    }
    if (mouseHoverCardId === cardId) {
        mouseHoverCardId = null;
    }
    if (dotHoverCardId === cardId) {
        dotHoverCardId = null;
    }
    syncStreamCardHighlightState();
    scheduleActiveProjectAutosave();
    syncDynamicBackgroundRefreshLoop();
    recordStreamTelemetry('card_remove_success', { cardId });
}

function buildResumePromptForCard(cardState) {
    const base = String(
        cardState?.lastAppliedPrompt ||
        cardState?.seedPrompt ||
        currentSceneState ||
        ''
    ).trim();

    if (!base) {
        return 'Continue the scene.';
    }

    return `${base}. Continue the same scene and visual style.`;
}

async function restartStreamCard(cardState, options = {}) {
    if (!cardState) {
        throw new Error('Invalid card state');
    }

    const apiKey = getOdysseyApiKey();
    if (!apiKey && !hasOdysseyCredentialsAccess()) {
        requestOdysseyApiKeyFromUser();
        throw new Error('Enter the demo password to resume this stream.');
    }

    const resumePrompt = buildResumePromptForCard(cardState);
    const preserveReplayUntilLive = options.preserveReplayUntilLive === true && cardState.replayActive;

    setCardStatusText(cardState, 'Resuming...');
    cardState.replayFallbackDisabled = true;

    await stopCardReplayRecorder(cardState, { keepChunks: false });
    if (!preserveReplayUntilLive) {
        clearCardReplayLoop(cardState, { revokeBlobUrl: true, immediate: true });
        clearCardFreezeFrame(cardState.cardEl);
    }

    try {
        if (cardState.isStreaming && cardState.client) {
            await cardState.client.endStream();
        }
    } catch (_) {
        // no-op
    }

    try {
        cardState.client?.disconnect();
    } catch (_) {
        // no-op
    }
    cardState.client = null;

    if (cardState.videoEl?.srcObject) {
        const tracks = cardState.videoEl.srcObject.getTracks?.() || [];
        tracks.forEach((track) => track.stop());
        cardState.videoEl.srcObject = null;
    }

    cardState.isConnected = false;
    cardState.isStreaming = false;

    const connectResult = await connectCardClientWithRetry(cardState, apiKey, {
        onStreamStarted: () => {
            cardState.isStreaming = true;
            cardState.isFrozen = false;
            clearCardReplayLoop(cardState, { revokeBlobUrl: true });
            cardState.replayFallbackDisabled = false;
            setCardStatusText(cardState, 'Streaming');
            recordStreamTelemetry('card_stream_started', { cardId: cardState.id, mode: 'resume' });
        },
        onStreamEnded: () => {
            recordStreamTelemetry('card_stream_ended', { cardId: cardState.id, mode: 'resume' });
            handleSecondaryCardStreamEnded(cardState);
        },
        onStreamError: (reason, message) => {
            handleSecondaryCardStreamError(cardState, reason, message);
        },
        onError: (error) => {
            if (isOdysseyConcurrentSessionError(error)) {
                console.warn('Card resume hit session limit; retrying...', error);
                setCardStatusText(cardState, 'Retrying...');
                return;
            }
            console.error('Card resume stream error:', error);
            setCardStatusText(cardState, 'Error');
        }
    });
    const client = connectResult.client;
    const mediaStream = connectResult.mediaStream;

    cardState.isConnected = true;
    if (cardState.videoEl) {
        cardState.videoEl.srcObject = mediaStream;
        cardState.videoEl.muted = true;
        cardState.videoEl.volume = 0;
    }
    if (!preserveReplayUntilLive) {
        clearCardFreezeFrame(cardState.cardEl);
    }
    await startCardReplayRecorder(cardState, mediaStream, { preserveActiveReplay: preserveReplayUntilLive });

    setCardStatusText(cardState, 'Starting stream...');
    recordStreamTelemetry('card_start_stream', { cardId: cardState.id, mode: 'resume' });
    await client.startStream({
        ...buildOdysseyStartOptions(resumePrompt, { portrait: false })
    });

    cardState.isConnected = true;
    cardState.isStreaming = true;
    cardState.isFrozen = false;
    cardState.lastAppliedPrompt = resumePrompt;
    clearCardReplayLoop(cardState, { revokeBlobUrl: true });
    cardState.replayFallbackDisabled = false;
    updateCardPromptAudit(cardState, {
        appliedText: resumePrompt,
        lastSentPrompt: resumePrompt,
        route: options.reason === 'duration-limit' ? 'auto-recovery' : 'resume'
    });
    markCardInteraction(cardState.id);
    setCardStatusText(cardState, 'Streaming');
}

async function applyPromptToCard(cardId, prompt, options = {}) {
    const cardState = streamCards.get(cardId);
    if (!cardState) {
        throw new Error('Target card not found');
    }

    if (!cardState.isStreaming || !cardState.client || !cardState.isConnected) {
        await restartStreamCard(cardState);
    }

    if (!cardState.client) {
        throw new Error('Card stream client unavailable');
    }

    setCardStatusText(cardState, 'Applying...');
    markCardInteraction(cardId);

    recordStreamTelemetry('card_interact_start', { cardId, route: options.route || 'card-edit' });
    try {
        await cardState.client.interact({ prompt });
    } catch (error) {
        recordStreamTelemetry('card_interact_error', {
            cardId,
            route: options.route || 'card-edit',
            message: error?.message || String(error || '')
        });
        throw error;
    }
    cardState.lastAppliedPrompt = prompt;
    cardState.isStreaming = true;
    cardState.isFrozen = false;
    cardState.replayActive = false;
    cardState.replayFallbackDisabled = false;
    updateCardPromptAudit(cardState, {
        rawText: String(options.rawText || cardState.promptAudit?.rawText || '').trim(),
        appliedText: prompt,
        lastSentPrompt: prompt,
        route: String(options.route || 'card-edit'),
        modifiers: options.modifiers || {}
    });
    recordStreamTelemetry('card_interact_success', { cardId, route: options.route || 'card-edit' });
    markCardInteraction(cardId);
    setCardStatusText(cardState, 'Streaming');
    setActiveStream('secondary', cardId);
    scheduleActiveProjectAutosave();
    markInstructionBannerInteractionComplete();
}

function createStreamCardShell(options = {}) {
    if (!videoCanvas) return null;

    const {
        left = null,
        top = null,
        centerCanvasPoint = null,
        zIndex = null,
        statusText = 'Preparing...',
        promptDraft = '',
        seedPrompt = '',
        lastAppliedPrompt = '',
        promptChips = [],
        freezeFrameData = '',
        bringToFrontCard = true,
        spawnFromCanvasPrompt = false
    } = options;

    const cardId = `stream-card-${++streamCardCounter}`;
    const cardEl = document.createElement('div');
    cardEl.className = 'video-card is-secondary liquid-glass';
    cardEl.dataset.cardId = cardId;
    cardEl.innerHTML = `
        <div class="liquid-glass__rim" aria-hidden="true"></div>
        <div class="video-card-controls">
            <span class="status-badge">Preparing...</span>
            <button class="video-card-remove liquid-glass-minus" type="button" title="Remove stream" aria-label="Remove stream">
                <span aria-hidden="true">&minus;</span>
            </button>
        </div>
        <div class="video-display">
            <video autoplay playsinline muted></video>
            <div class="card-center-loading" aria-hidden="true">
                <span class="card-center-loading-spinner"></span>
            </div>
            <div class="finger-cursor"></div>
            <div class="click-marker"></div>
        </div>
        <div class="card-lifecycle" aria-live="polite">
            <div class="card-lifecycle-current">
                <span class="card-lifecycle-dot" aria-hidden="true"></span>
                <span class="card-lifecycle-text">Preparing...</span>
            </div>
            <div class="card-lifecycle-steps" aria-hidden="true"></div>
        </div>
        <details class="card-prompt-audit">
            <summary>Prompt audit</summary>
            <div class="card-prompt-audit-panel">
                <div class="card-prompt-audit-row">
                    <span class="card-prompt-audit-label">Raw</span>
                    <span class="card-prompt-audit-value" data-audit-field="raw">--</span>
                </div>
                <div class="card-prompt-audit-row">
                    <span class="card-prompt-audit-label">Applied</span>
                    <span class="card-prompt-audit-value" data-audit-field="applied">--</span>
                </div>
                <div class="card-prompt-audit-row">
                    <span class="card-prompt-audit-label">Sent to Odyssey</span>
                    <span class="card-prompt-audit-value" data-audit-field="sent">--</span>
                </div>
                <div class="card-prompt-audit-row">
                    <span class="card-prompt-audit-label">Modifiers</span>
                    <span class="card-prompt-audit-value" data-audit-field="modifiers">none</span>
                </div>
                <div class="card-prompt-audit-row">
                    <span class="card-prompt-audit-label">Route</span>
                    <span class="card-prompt-audit-value" data-audit-field="route">idle</span>
                </div>
            </div>
        </details>
        <div class="video-card-chip-layer"></div>
    `;

    videoCanvas.appendChild(cardEl);

    let resolvedLeft = Number.isFinite(left) ? left : null;
    let resolvedTop = Number.isFinite(top) ? top : null;

    if (Number.isFinite(centerCanvasPoint?.x) && Number.isFinite(centerCanvasPoint?.y)) {
        const measuredRect = cardEl.getBoundingClientRect();
        const measuredWidth = measuredRect.width || cardEl.offsetWidth || 0;
        const measuredHeight = measuredRect.height || cardEl.offsetHeight || 0;
        resolvedLeft = centerCanvasPoint.x - (measuredWidth / 2);
        resolvedTop = centerCanvasPoint.y - (measuredHeight / 2);
    }

    const startPos = Number.isFinite(resolvedLeft) && Number.isFinite(resolvedTop)
        ? { left: resolvedLeft, top: resolvedTop }
        : getNextCardPosition();
    positionCard(cardEl, startPos.left, startPos.top);
    makeCardDraggable(cardEl);

    if (bringToFrontCard) {
        bringCardToFront(cardEl);
    } else if (Number.isFinite(zIndex)) {
        cardEl.style.zIndex = String(zIndex);
        cardZIndex = Math.max(cardZIndex, zIndex);
    } else {
        bringCardToFront(cardEl);
    }

    if (spawnFromCanvasPrompt) {
        cardEl.classList.add('spawn-from-canvas-prompt');
        setTimeout(() => {
            if (cardEl.isConnected) {
                cardEl.classList.remove('spawn-from-canvas-prompt');
            }
        }, 380);
    }

    const statusEl = cardEl.querySelector('.status-badge');
    const controlsEl = cardEl.querySelector('.video-card-controls');
    const removeBtn = cardEl.querySelector('.video-card-remove');
    const displayEl = cardEl.querySelector('.video-display');
    const videoEl = cardEl.querySelector('video');
    const chipLayerEl = cardEl.querySelector('.video-card-chip-layer');
    const centerLoadingEl = cardEl.querySelector('.card-center-loading');
    const lifecycleEl = cardEl.querySelector('.card-lifecycle');
    const lifecycleTextEl = cardEl.querySelector('.card-lifecycle-text');
    const lifecycleStepsEl = cardEl.querySelector('.card-lifecycle-steps');
    const auditEl = cardEl.querySelector('.card-prompt-audit');
    const auditEls = {
        rawEl: cardEl.querySelector('[data-audit-field="raw"]'),
        appliedEl: cardEl.querySelector('[data-audit-field="applied"]'),
        sentEl: cardEl.querySelector('[data-audit-field="sent"]'),
        modifiersEl: cardEl.querySelector('[data-audit-field="modifiers"]'),
        routeEl: cardEl.querySelector('[data-audit-field="route"]')
    };
    const cardFingerCursorEl = cardEl.querySelector('.finger-cursor');
    const cardClickMarkerEl = cardEl.querySelector('.click-marker');

    assignLiquidGlassPhase(cardEl);
    assignLiquidGlassPhase(removeBtn);
    const createdAt = Date.now();

    const cardState = {
        id: cardId,
        createdAt,
        lastInteractedAt: createdAt,
        cardEl,
        controlsEl,
        statusEl,
        removeBtn,
        displayEl,
        videoEl,
        chipLayerEl,
        centerLoadingEl,
        lifecycleEl,
        lifecycleTextEl,
        lifecycleStepsEl,
        auditEl,
        auditEls,
        fingerCursorEl: cardFingerCursorEl,
        clickMarkerEl: cardClickMarkerEl,
        client: null,
        isConnected: false,
        isStreaming: false,
        isFrozen: false,
        isPromptSubmitting: false,
        promptChips: [],
        activeChipId: null,
        pendingSpeechChipId: null,
        pendingSpeechDraftText: '',
        skipNextVoiceCommitUntil: 0,
        isChipRevealActive: false,
        chipRevealReason: null,
        chipLayoutVersion: 0,
        controlAnchorRectCache: null,
        seedPrompt: String(seedPrompt || ''),
        lastAppliedPrompt: String(lastAppliedPrompt || ''),
        replayRecorder: null,
        replayChunks: [],
        replayBlobUrl: '',
        replayActive: false,
        replaySupported: isReplayRecorderSupported(),
        replayVideoEl: null,
        replayCaptureStream: null,
        replayFallbackDisabled: false,
        replayHideTimer: null,
        statusHistory: [],
        recoveryInFlight: false,
        promptAudit: createEmptyCardPromptAudit(lastAppliedPrompt || seedPrompt)
    };

    streamCards.set(cardId, cardState);
    attachDisplayClickHandler(displayEl, cardId);
    attachCardHoverHandlers(cardEl, cardId);
    syncStreamCardHighlightState();
    onFirstCardCreated();
    scheduleActiveProjectAutosave();
    syncDynamicBackgroundRefreshLoop();

    if (removeBtn) {
        removeBtn.addEventListener('click', async () => {
            await stopAndRemoveStreamCard(cardId);
        });
    }

    setCardStatusText(cardState, statusText || 'Stopped');
    syncCardPromptAuditUI(cardState);

    if (Array.isArray(promptChips) && promptChips.length) {
        cardState.promptChips = [];
        chipLayerEl.innerHTML = '';
        promptChips
            .map((chip) => normalizePromptChipSnapshot(chip))
            .filter(Boolean)
            .forEach((chipSnapshot) => {
                createCardPromptChip(cardState, {
                    id: chipSnapshot.id,
                    type: chipSnapshot.type,
                    source: chipSnapshot.source,
                    text: chipSnapshot.text,
                    finalPrompt: chipSnapshot.finalPrompt,
                    createdAt: chipSnapshot.createdAt,
                    isCommitted: chipSnapshot.isCommitted,
                    position: chipSnapshot.position
                });
            });
    } else if (promptDraft) {
        updateDraftSpeechChipText(cardState, String(promptDraft));
    }

    if (!cardState.promptChips.some((chip) => chip.type === 'seed') && cardState.seedPrompt) {
        createSeedChip(cardState, cardState.seedPrompt);
    }

    if (freezeFrameData) {
        const freezeEl = getOrCreateFreezeFrameEl(cardEl);
        if (freezeEl) {
            freezeEl.src = String(freezeFrameData);
            freezeEl.style.display = 'block';
            if (!freezeEl.complete) {
                freezeEl.addEventListener('load', () => {}, { once: true });
            }
            cardState.isFrozen = true;
            if (statusEl && (!statusText || statusText === 'Preparing...')) {
                setCardStatusText(cardState, 'Frozen');
            }
        }
    }

    setCardActiveChip(cardState, cardState.activeChipId || getLastCommittedChip(cardState)?.id || null);
    scheduleCardChipLayout(cardState, { force: true });
    syncCardPromptDockState(cardState);
    return cardState;
}

function createStreamCardFromSnapshot(snapshot = {}) {
    const cardState = createStreamCardShell({
        left: Number.isFinite(snapshot?.left) ? snapshot.left : null,
        top: Number.isFinite(snapshot?.top) ? snapshot.top : null,
        zIndex: Number.isFinite(snapshot?.zIndex) ? snapshot.zIndex : null,
        statusText: String(snapshot?.statusText || (snapshot?.freezeFrameData ? 'Frozen' : 'Stopped')),
        promptDraft: String(snapshot?.promptDraft || ''),
        seedPrompt: String(snapshot?.seedPrompt || ''),
        lastAppliedPrompt: String(snapshot?.lastAppliedPrompt || ''),
        promptChips: Array.isArray(snapshot?.promptChips) ? snapshot.promptChips : [],
        freezeFrameData: String(snapshot?.freezeFrameData || ''),
        bringToFrontCard: false
    });

    if (!cardState) return null;

    cardState.client = null;
    cardState.isConnected = false;
    cardState.isStreaming = false;
    cardState.isFrozen = Boolean(snapshot?.freezeFrameData);
    setCardStatusText(cardState, cardState.isFrozen ? 'Frozen' : 'Stopped');

    return cardState;
}

async function createStreamCardFromPrompt(rawPrompt, options = {}) {
    const apiKey = getOdysseyApiKey();
    if (!apiKey && !hasOdysseyCredentialsAccess()) {
        requestOdysseyApiKeyFromUser();
        return;
    }

    const spawnCanvasPoint = options?.spawnCanvasPoint;
    const hasSpawnPoint = Number.isFinite(spawnCanvasPoint?.x) && Number.isFinite(spawnCanvasPoint?.y);
    const cardState = createStreamCardShell({
        statusText: 'Preparing...',
        centerCanvasPoint: hasSpawnPoint
            ? { x: spawnCanvasPoint.x, y: spawnCanvasPoint.y }
            : null,
        spawnFromCanvasPrompt: hasSpawnPoint
    });
    if (!cardState) return;

    const cardId = cardState.id;
    const cardEl = cardState.cardEl;
    const videoEl = cardState.videoEl;

    const isCardAlive = () => streamCards.has(cardId);
    const cleanupDetachedStream = async () => {
        await stopCardReplayRecorder(cardState, { keepChunks: false });
        clearCardReplayLoop(cardState, { revokeBlobUrl: true, immediate: true });

        try {
            if (cardState.isStreaming && cardState.client) {
                await cardState.client.endStream();
            }
        } catch (_) {
            // no-op
        }

        try {
            cardState.client?.disconnect();
        } catch (_) {
            // no-op
        }
        cardState.client = null;

        if (videoEl && videoEl.srcObject) {
            const tracks = videoEl.srcObject.getTracks?.() || [];
            tracks.forEach((track) => track.stop());
            videoEl.srcObject = null;
        }
    };

    try {
        setCardStatusText(cardState, 'Prompting...');
        const skipPromptRewrite = options?.skipPromptRewrite === true;
        const preparedPrompt = skipPromptRewrite
            ? String(rawPrompt || '').trim()
            : await generatePromptForCard(rawPrompt);
        cardState.seedPrompt = preparedPrompt;
        cardState.lastAppliedPrompt = preparedPrompt;
        updateCardPromptAudit(cardState, {
            rawText: String(options.rawText || rawPrompt || '').trim(),
            appliedText: preparedPrompt,
            route: String(options.auditRoute || 'new-card'),
            modifiers: options.auditModifiers || {}
        });
        if (!isCardAlive()) {
            await cleanupDetachedStream();
            return;
        }
        createSeedChip(cardState, preparedPrompt);

        setCardStatusText(cardState, 'Connecting...');
        const connectResult = await connectCardClientWithRetry(cardState, apiKey, {
            onStreamStarted: () => {
                cardState.isStreaming = true;
                cardState.isFrozen = false;
                cardState.replayActive = false;
                cardState.replayFallbackDisabled = false;
                setCardStatusText(cardState, 'Streaming');
                recordStreamTelemetry('card_stream_started', { cardId, mode: 'new-card' });
            },
            onStreamEnded: () => {
                recordStreamTelemetry('card_stream_ended', { cardId, mode: 'new-card' });
                handleSecondaryCardStreamEnded(cardState);
            },
            onStreamError: (reason, message) => {
                handleSecondaryCardStreamError(cardState, reason, message);
            },
            onError: (error) => {
                if (isOdysseyConcurrentSessionError(error)) {
                    console.warn('Secondary card session limit reached; retrying...', error);
                    setCardStatusText(cardState, 'Retrying...');
                    return;
                }
                console.error('Secondary card stream error:', error);
                setCardStatusText(cardState, 'Error');
            }
        });
        const client = connectResult.client;
        const mediaStream = connectResult.mediaStream;
        if (!isCardAlive()) {
            await cleanupDetachedStream();
            return;
        }

        cardState.isConnected = true;
        videoEl.srcObject = mediaStream;
        videoEl.muted = true;
        videoEl.volume = 0;
        clearCardFreezeFrame(cardEl);
        await startCardReplayRecorder(cardState, mediaStream);

        setCardStatusText(cardState, 'Starting stream...');
        recordStreamTelemetry('card_start_stream', { cardId, mode: 'new-card' });
        await client.startStream({
            ...buildOdysseyStartOptions(preparedPrompt, { portrait: false })
        });
        if (!isCardAlive()) {
            await cleanupDetachedStream();
            return;
        }

        cardState.isStreaming = true;
        cardState.isFrozen = false;
        cardState.replayActive = false;
        cardState.replayFallbackDisabled = false;
        updateCardPromptAudit(cardState, {
            appliedText: preparedPrompt,
            lastSentPrompt: preparedPrompt,
            route: String(options.auditRoute || 'new-card'),
            modifiers: options.auditModifiers || {}
        });
        markCardInteraction(cardId);
        maybeAutoSetProjectTitleFromPrompt(preparedPrompt);
        setCardStatusText(cardState, 'Streaming');
        setActiveStream('secondary', cardId);
        scheduleActiveProjectAutosave();
        scheduleDynamicBackgroundRefresh({ immediate: true, delayMs: 320 });
        markInstructionBannerInteractionComplete();
        return cardState;
    } catch (error) {
        console.error('Failed to create stream card:', error);
        await cleanupDetachedStream();
        if (isCardAlive()) {
            setCardStatusText(cardState, 'Error');
        }
        return null;
    }
}

async function removePrimaryCard() {
    if (activeStreamType === 'primary') {
        setActiveStream(null, null);
    }

    if (videoCard && videoCard.isConnected) {
        videoCard.remove();
    }

    await stopEverything();

    if (videoElement && videoElement.srcObject) {
        const tracks = videoElement.srcObject.getTracks?.() || [];
        tracks.forEach((track) => track.stop());
        videoElement.srcObject = null;
    }
}

// ==================== START/STOP ====================

async function enterAppFromLanding() {
    const apiKey = getOdysseyApiKey();

    if (!apiKey && !hasOdysseyCredentialsAccess()) {
        showOdysseyKeyGate(odysseyCredentialsUrl ? 'Enter the demo password to start.' : 'Enter an Odyssey API key to start.');
        return;
    }

    if (apiKey) {
        persistOdysseyApiKey(apiKey);
    }
    hideOdysseyKeyGate();

    try {
        // Show app immediately after title screen tap.
        // No default stream starts automatically: the first user prompt creates the first card.
        if (landingScreen) {
            landingScreen.style.display = 'none';
        }
        videoSection.style.display = 'block';
        hidePrimaryCardTemplate();
        appSessionActive = true;
        if (isMinimalUiMode) {
            scheduleInstructionBannerAutoHide();
        }
        syncDynamicBackgroundRefreshLoop();

        // Keep runtime sense flags synced with toggles.
        speechEnabled = !!senseVoice.checked;
        handGestureEnabled = !!senseGestures.checked;
        faceDetectionEnabled = !!senseVision.checked;

        // Warm up only the streams needed by enabled senses.
        warmMediaDeviceStreams({
            needMic: speechEnabled,
            needCamera: handGestureEnabled || faceDetectionEnabled
        }).catch((error) => {
            console.warn('Media warmup failed:', error?.message || error);
        });

        // Explicit idle state for empty canvas startup.
        odysseyClient = null;
        isConnected = false;
        isStreaming = false;
        suppressPrimaryAutoRestart = false;
        setActiveStream(null, null);
        setSidebarStreamStatus('Idle');
        if (videoCardStatus) {
            videoCardStatus.textContent = 'Idle';
            videoCardStatus.className = 'status-badge';
        }
        interactionCount = 0;
        setInteractionCountDisplay(0);
        resetSpeechMeta();
        if (promptInput && hasOdysseyCredentialsAccess()) {
            promptInput.placeholder = 'access ready - speak or type to start wandering...';
        }
        showWelcomeModal();

        if (handGestureEnabled) {
            startHandGestureTracking().catch((error) => {
                console.warn('Hand tracking start failed:', error.message);
            });
        }
        if (faceDetectionEnabled) {
            startFaceDetection().catch((error) => {
                console.warn('Face detection start failed:', error.message);
            });
        }
        if (speechEnabled) {
            ensureVoiceRuntimeReady().catch((error) => {
                console.warn('Voice runtime start failed:', error.message);
            });
        }

        console.log('App ready on empty canvas. Send first prompt to create first stream card.');

    } catch (error) {
        console.error('Connection error:', error);
        alert('Failed to connect: ' + error.message);
        if (landingScreen) {
            videoSection.style.display = 'none';
            landingScreen.style.display = 'flex';
        } else {
            videoSection.style.display = 'block';
        }
        appSessionActive = false;
    }
}

// stopBtn removed - now using removeVideoCardBtn instead

// Handle manual prompt from input
async function handleManualPrompt(text) {
    if (!text || !isConnected) return;
    
    console.log('📝 Manual prompt:', text);
    
    try {
        setGeneratingIndicator(true);
        
        // Use the same flow as voice interaction
        const prompt = await generatePromptWithOpenAI(text);
        console.log('📤 SENDING TO ODYSSEY:', prompt);
        
        await odysseyClient.interact({ prompt: prompt });
        
        interactionCount++;
        setInteractionCountDisplay(interactionCount);
        
        storyContext.push(prompt);
        if (storyContext.length > 10) storyContext.shift();
        
        setTimeout(() => {
            setGeneratingIndicator(false);
        }, 2000);
        
        console.log('✅ Manual interaction applied');
        
    } catch (error) {
        console.error('❌ Manual interaction error:', error);
        setGeneratingIndicator(false);
    }
}

async function stopEverything() {
    clearInstructionBannerAutoHideTimer();

    if (recognition) {
        recognition.stop();
    }
    
    if (autoEvolutionInterval) {
        clearInterval(autoEvolutionInterval);
    }
    
    if (audioContext) {
        audioContext.close();
    }
    stopAudioAnalysisLoop();
    audioContext = null;
    analyser = null;
    microphone = null;
    audioDataArray = null;
    audioBufferLength = 0;
    
    handTrackerRecovering = false;
    handTrackingStartInFlight = false;
    stopHandTrackingLoop();
    await closeHandsRuntime();
    
    // Stop face detection
    faceDetectionEnabled = false;
    if (faceDetectionInterval) {
        clearTimeout(faceDetectionInterval);
        faceDetectionInterval = null;
    }
    
    if (odysseyClient) {
        try {
            if (isStreaming) {
                await odysseyClient.endStream();
            }
            odysseyClient.disconnect();
        } catch (error) {
            console.error('Disconnect error:', error);
        }
        odysseyClient = null;
    }

    for (const cardState of streamCards.values()) {
        await stopCardReplayRecorder(cardState, { keepChunks: false });
        clearCardReplayLoop(cardState, { revokeBlobUrl: true, immediate: true });
    }
    
    isConnected = false;
    isStreaming = false;
    if (activeStreamType === 'primary') {
        setActiveStream(null, null);
    }
    interactionCount = 0;
    recentWords = [];
    storyContext = [];
    initialStoryline = '';
    currentSceneState = '';
    lastVoiceInteractionTime = 0;
    lastAudioEventTime = 0;
    initialStoryline = '';
    currentSceneState = '';
    lastClickPos = null;
    lastClickFrameData = null;
    visionResult = null;
    lastClickTargetCardId = null;
    hoverPointerCardId = null;
    mouseHoverCardId = null;
    dotHoverCardId = null;
    cardVoiceAimState.cardId = null;
    cardVoiceAimState.xNorm = 0.5;
    cardVoiceAimState.yNorm = 0.5;
    cardVoiceAimState.timestamp = 0;
    cardVoiceAimState.source = '';
    endPinchDrag();
    pinchDragState = null;
    pinchDetectedFrames = 0;
    grabDetectedFrames = 0;
    grabReleaseFrames = 0;
    handMissedFrames = 0;
    lastCameraRecoveryAttempt = 0;
    isPointing = false;
    currentGesture = null;
    temporaryMuteUntil = 0;
    if (preAnalyzeAbortController) {
        preAnalyzeAbortController.abort();
        preAnalyzeAbortController = null;
    }
    if (visionGroundAbortController) {
        visionGroundAbortController.abort();
        visionGroundAbortController = null;
    }
    currentEmotion = 'neutral';
    emotionConfidence = 0;
    applyEmotionColors('neutral');
    syncStreamCardHighlightState();
    hideFingerCursor();
    hideAllVoicePromptPanels();
    hideCanvasVoicePrompt();
    resetSpeechMeta();
    cardChipLayoutRaf.forEach((rafId) => cancelAnimationFrame(rafId));
    cardChipLayoutRaf.clear();
    syncDynamicBackgroundRefreshLoop();
}

// ==================== AUDIO ANALYSIS ====================

function stopAudioAnalysisLoop() {
    if (audioAnalysisTimeoutId) {
        clearTimeout(audioAnalysisTimeoutId);
        audioAnalysisTimeoutId = null;
    }
    if (audioAnalysisFrameId) {
        cancelAnimationFrame(audioAnalysisFrameId);
        audioAnalysisFrameId = null;
    }
}

async function setupAudioAnalysis() {
    try {
        // Use existing microphone stream
        if (!hasLiveAudioTrack(window.microphoneStream)) {
            console.error('❌ No microphone stream available');
            return;
        }
        
        // Create audio context
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        microphone = audioContext.createMediaStreamSource(window.microphoneStream);
        
        analyser.fftSize = 2048;
        audioBufferLength = analyser.frequencyBinCount;
        audioDataArray = new Uint8Array(audioBufferLength);
        
        microphone.connect(analyser);
        
        // Start continuous analysis (throttled for low-end devices).
        stopAudioAnalysisLoop();
        analyzeAudioContinuously();
        
        debugLog('Audio analysis started');
        
    } catch (error) {
        console.error('Audio analysis setup error:', error);
    }
}

function analyzeAudioContinuously() {
    if (!isSenseRuntimeActive() || !speechEnabled || !analyser || !audioDataArray || !audioBufferLength) {
        stopAudioAnalysisLoop();
        return;
    }
    
    analyser.getByteFrequencyData(audioDataArray);
    
    // Calculate volume (0-100)
    let sum = 0;
    for (let i = 0; i < audioBufferLength; i++) {
        sum += audioDataArray[i];
    }
    const volume = Math.round((sum / audioBufferLength / 255) * 100);
    
    // Find dominant frequency (pitch)
    let maxValue = 0;
    let maxIndex = 0;
    for (let i = 0; i < audioBufferLength; i++) {
        if (audioDataArray[i] > maxValue) {
            maxValue = audioDataArray[i];
            maxIndex = i;
        }
    }
    
    const nyquist = audioContext.sampleRate / 2;
    const frequency = (maxIndex * nyquist) / audioBufferLength;
    
    // Determine pitch category
    let pitch;
    if (frequency < 150) pitch = 'very-low';
    else if (frequency < 300) pitch = 'low';
    else if (frequency < 500) pitch = 'mid-low';
    else if (frequency < 1000) pitch = 'mid';
    else if (frequency < 2000) pitch = 'mid-high';
    else pitch = 'high';
    
    // Calculate energy
    const energy = Math.round((maxValue / 255) * 100);
    
    // Track volume changes
    const volumeChange = Math.abs(volume - previousVolume);
    volumeHistory.push(volume);
    if (volumeHistory.length > 30) volumeHistory.shift(); // Keep last 30 frames
    
    // Track duration of loud/quiet
    if (volume > 50) {
        loudDuration += 0.1;
        quietDuration = 0;
    } else if (volume < 15) {
        quietDuration += 0.1;
        loudDuration = 0;
    } else {
        loudDuration = 0;
        quietDuration = 0;
    }
    
    // Update global features
    currentAudioFeatures = {
        volume: volume,
        pitch: pitch,
        energy: energy,
        frequency: Math.round(frequency),
        volumeChange: volumeChange,
        loudDuration: loudDuration,
        quietDuration: quietDuration
    };
    
    previousVolume = volume;
    
    // Track peaks during speech
    if (isSpeaking) {
        speechAudioPeaks.maxVolume = Math.max(speechAudioPeaks.maxVolume, volume);
        speechAudioPeaks.maxEnergy = Math.max(speechAudioPeaks.maxEnergy, energy);
        speechAudioPeaks.volumeSamples.push(volume);
        
        // Update dominant pitch during speech
        if (volume > 15) { // Only count pitch when actually speaking
            speechAudioPeaks.dominantPitch = pitch;
        }
        
        // Calculate average volume
        if (speechAudioPeaks.volumeSamples.length > 0) {
            const sum = speechAudioPeaks.volumeSamples.reduce((a, b) => a + b, 0);
            speechAudioPeaks.avgVolume = Math.round(sum / speechAudioPeaks.volumeSamples.length);
        }
        
    }
    
    // Update UI
    if (volumeValueEl) volumeValueEl.textContent = volume + '%';
    if (pitchValueEl) pitchValueEl.textContent = pitch;
    if (energyValueEl) energyValueEl.textContent = energy;
    
    stopAudioAnalysisLoop();
    audioAnalysisTimeoutId = setTimeout(() => {
        audioAnalysisFrameId = requestAnimationFrame(analyzeAudioContinuously);
    }, AUDIO_ANALYSIS_INTERVAL_MS);
}

// ==================== SPEECH RECOGNITION ====================

function flushSpeechDraftUpdate() {
    speechDraftAnimationFrame = null;
    const payload = pendingSpeechDraftUpdate;
    pendingSpeechDraftUpdate = null;
    if (!payload) return;

    if (payload.isCanvasVoiceContext) {
        if (!isCanvasVoicePromptListeningContext()) {
            seedCanvasVoicePromptTrackingFromRecentPointing();
        }
        if (!emptyCanvasVoicePromptState.eligible) {
            return;
        }
        updateCanvasVoicePromptText(payload.displayText, { mode: 'speech' });
        showCanvasVoicePromptAtTrackedPoint();
        return;
    }

    if (payload.transcriptTargetCardId) {
        setCardPromptDraft(payload.transcriptTargetCardId, payload.displayText, { trackChange: false });
    }
}

function scheduleSpeechDraftUpdate(displayText, transcriptTargetCardId, isCanvasVoiceContext) {
    pendingSpeechDraftUpdate = {
        displayText: String(displayText || ''),
        transcriptTargetCardId: transcriptTargetCardId || null,
        isCanvasVoiceContext: !!isCanvasVoiceContext
    };

    if (speechDraftAnimationFrame) return;
    speechDraftAnimationFrame = requestAnimationFrame(flushSpeechDraftUpdate);
}

function startSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        console.warn('Speech recognition not supported in this browser.');
        return;
    }

    recognition = new SpeechRecognition();

    const languageCandidates = Array.from(new Set([
        String(navigator.language || '').trim(),
        'en-US',
        'en'
    ].filter(Boolean)));
    let languageCandidateIndex = 0;
    let manualLanguageRetryPending = false;

    const applyRecognitionConfig = () => {
        recognition.continuous = true; // Keep listening continuously
        recognition.interimResults = true;
        recognition.maxAlternatives = SPEECH_RESULT_MAX_ALTERNATIVES;
        recognition.lang = languageCandidates[Math.min(languageCandidateIndex, languageCandidates.length - 1)] || 'en-US';

        // Keep cloud/browser mode; local-only mode commonly triggers language-not-supported.
        if ('processLocally' in recognition) {
            try {
                recognition.processLocally = false;
            } catch (_) {
                // no-op
            }
        }

        applySpeechRecognitionHints(recognition);
    };

    applyRecognitionConfig();

    recognition.onstart = () => {
        console.log('Speech recognition started (' + recognition.lang + ')');
        speechStatusEl.className = 'mic-dot listening';
        renderSpeechFeedbackMeta();
    };

    recognition.onresult = async (event) => {
        // Check if we should temporarily ignore speech (during mute period)
        const now = Date.now();
        if (temporaryMuteUntil > 0 && now < temporaryMuteUntil) {
            debugLog('Speech ignored (waiting for click confirmation)');
            return;
        }

        let interimTranscript = '';
        let finalTranscript = '';
        let asrUsedAlternative = false;
        let primaryConfidence = 0;
        let chosenConfidence = 0;
        const hintTokens = collectDynamicSpeechHints();

        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcriptMeta = chooseSpeechTranscriptFromAlternatives(event.results[i], hintTokens);
            const transcript = String(transcriptMeta.transcript || '').trim();
            if (!transcript) continue;
            asrUsedAlternative = asrUsedAlternative || !!transcriptMeta.usedAlternative;
            primaryConfidence = Math.max(primaryConfidence, Number(transcriptMeta.primaryConfidence || 0));
            chosenConfidence = Math.max(chosenConfidence, Number(transcriptMeta.chosenConfidence || 0));
            if (event.results[i].isFinal) {
                finalTranscript += `${transcript} `;
            } else {
                interimTranscript += `${transcript} `;
            }
        }
        interimTranscript = interimTranscript.trim();
        finalTranscript = finalTranscript.trim();

        const canvasVoiceCaptureActive = isCanvasVoiceCaptureContextActive();
        const liveHoverCardId = canvasVoiceCaptureActive
            ? (hoverPointerCardId || dotHoverCardId || null)
            : getLiveSpeechHoverCardId();
        const hoverTargetCardId = getStreamingPromptTargetCardId(liveHoverCardId);
        const activeFallbackCardId = getStreamingPromptTargetCardId(activeStreamCardId || lastClickTargetCardId || null);
        const transcriptTargetCardId = canvasVoiceCaptureActive
            ? hoverTargetCardId
            : (hoverTargetCardId || activeFallbackCardId);
        const isCanvasVoiceContext = !transcriptTargetCardId && canvasVoiceCaptureActive;

        // Start tracking audio peaks when speech starts and create a draft chip immediately.
        const hasSpeechSignal = !!(interimTranscript || finalTranscript);
        if (hasSpeechSignal && !isSpeaking) {
            isSpeaking = true;
            resetSpeechMeta();
            speechAudioPeaks = {
                maxVolume: 0,
                maxEnergy: 0,
                dominantPitch: 'mid',
                avgVolume: 0,
                volumeSamples: []
            };
            if (transcriptTargetCardId) {
                const targetCardState = streamCards.get(transcriptTargetCardId);
                if (targetCardState) {
                    startDraftSpeechChip(targetCardState);
                }
            }
            debugLog('Started tracking speech audio peaks');
        }

        // Update display with what user is saying
        const displayText = finalTranscript || interimTranscript;
        if (displayText) {
            scheduleSpeechDraftUpdate(displayText, transcriptTargetCardId, isCanvasVoiceContext);
            speechStatusEl.className = 'mic-dot speaking';
            patchSpeechMeta({
                rawText: displayText,
                route: transcriptTargetCardId ? 'card-edit' : (canvasVoiceCaptureActive ? 'canvas-create' : 'ignored'),
                stage: finalTranscript ? 'transcript-final' : 'transcript-interim',
                asr: {
                    usedAlternative: asrUsedAlternative,
                    primaryConfidence,
                    chosenConfidence
                }
            });
        }

        if (finalTranscript) {
            const spokenText = finalTranscript.trim();

            // Stop tracking and capture the peaks
            isSpeaking = false;
            console.log('Speech ended - peaks:', speechAudioPeaks);

            // Override current audio features with speech peaks
            const originalFeatures = { ...currentAudioFeatures };
            currentAudioFeatures = {
                volume: speechAudioPeaks.maxVolume || currentAudioFeatures.volume,
                pitch: speechAudioPeaks.dominantPitch || currentAudioFeatures.pitch,
                energy: speechAudioPeaks.maxEnergy || currentAudioFeatures.energy,
                frequency: currentAudioFeatures.frequency,
                volumeChange: currentAudioFeatures.volumeChange,
                loudDuration: currentAudioFeatures.loudDuration,
                quietDuration: currentAudioFeatures.quietDuration
            };

            addToRecentWords(spokenText);
            debugLog('Recognized:', spokenText);
            debugLog('Speech peaks - Vol:', speechAudioPeaks.maxVolume, 'Energy:', speechAudioPeaks.maxEnergy);

            const onMetaUpdate = (metaPatch = {}) => {
                patchSpeechMeta(metaPatch);
            };

            let routeResult = null;

            // Process speech for hover-grounded card edits or empty-canvas pointed creation.
            if (transcriptTargetCardId) {
                console.log(`Speech routing: card-edit -> ${transcriptTargetCardId}`);
                debugLog('Voice captured for streaming-card hover edit:', spokenText, transcriptTargetCardId);
                routeResult = await handleVoiceGroundedPrompt(spokenText, transcriptTargetCardId, { onMetaUpdate });
            } else if (canvasVoiceCaptureActive) {
                console.log('Speech routing: canvas-create');
                debugLog('Voice captured for empty-canvas generation:', spokenText);
                routeResult = await handleCanvasPointedPrompt(spokenText, { onMetaUpdate });
            } else {
                console.log('Speech routing: ignored (no active target)');
                debugLog('Speech ignored (no active hover/canvas target)');
                routeResult = {
                    appliedPrompt: 'No active target',
                    route: 'ignored',
                    locationApplied: false,
                    emotionApplied: false,
                    audioApplied: false
                };
            }

            if (routeResult) {
                patchSpeechMeta({
                    appliedText: String(routeResult.appliedPrompt || '').trim() || 'No active target',
                    route: String(routeResult.route || 'ignored'),
                    stage: 'commit',
                    locationRewrite: !!routeResult.locationApplied,
                    emotionApplied: !!routeResult.emotionApplied,
                    audioApplied: !!routeResult.audioApplied
                });
            }

            // Restore original audio features after processing
            setTimeout(() => {
                currentAudioFeatures = originalFeatures;
            }, 3000);
        }
    };

    let shouldRestart = true;

    recognition.onerror = (event) => {
        // Ignore no-speech errors - don't log, don't affect restart
        if (event.error === 'no-speech') {
            shouldRestart = true; // Still should restart
            return;
        }

        // Ignore aborted
        if (event.error === 'aborted') {
            return;
        }

        // Log other errors
        console.log('Speech recognition event:', event.error);

        if (event.error === 'phrases-not-supported') {
            if (speechPhraseHintsEnabled) {
                speechPhraseHintsEnabled = false;
                if ('phrases' in recognition) {
                    try {
                        recognition.phrases = [];
                    } catch (_) {
                        // no-op
                    }
                }
                if (!speechPhraseUnsupportedLogged) {
                    console.warn('Speech phrase hints not supported in this browser; continuing without phrase hints.');
                    speechPhraseUnsupportedLogged = true;
                }
            }
            shouldRestart = true;
            return;
        }

        if (event.error === 'grammar-not-supported') {
            if (speechGrammarHintsEnabled) {
                speechGrammarHintsEnabled = false;
                if ('grammars' in recognition) {
                    try {
                        recognition.grammars = null;
                    } catch (_) {
                        // no-op
                    }
                }
                if (!speechGrammarUnsupportedLogged) {
                    console.warn('Speech grammar hints not supported in this browser; continuing without grammar hints.');
                    speechGrammarUnsupportedLogged = true;
                }
            }
            shouldRestart = true;
            return;
        }

        if (event.error === 'language-not-supported') {
            const failedLang = recognition.lang;
            if (languageCandidateIndex < languageCandidates.length - 1) {
                languageCandidateIndex += 1;
                shouldRestart = false;
                manualLanguageRetryPending = true;
                const nextLang = languageCandidates[languageCandidateIndex];
                console.warn('Speech language "' + failedLang + '" unsupported. Retrying with "' + nextLang + '".');

                try {
                    recognition.stop();
                } catch (_) {
                    // no-op
                }

                setTimeout(() => {
                    if (!isSenseRuntimeActive() || !speechEnabled) return;
                    try {
                        applyRecognitionConfig();
                        recognition.start();
                    } catch (_) {
                        // no-op
                    }
                }, 220);
                return;
            }

            shouldRestart = false;
            if (speechStatusEl) {
                speechStatusEl.className = 'mic-dot';
            }
            console.error('Speech recognition disabled: no supported language profile found for this browser.');
            return;
        }

        // Permission/activation issues can happen before the first user gesture.
        // Keep voice enabled and retry on the next interaction.
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            console.warn('Microphone access not allowed yet. Retrying after user interaction.');
            shouldRestart = false;
            if (speechStatusEl) {
                speechStatusEl.className = 'mic-dot';
            }
            armVoiceRetryOnNextInteraction();
        }
    };

    recognition.onend = () => {
        if (manualLanguageRetryPending) {
            manualLanguageRetryPending = false;
            return;
        }

        // Restart while app session is active and voice is enabled.
        if (shouldRestart && isSenseRuntimeActive() && speechEnabled) {
            setTimeout(() => {
                if (isSenseRuntimeActive() && speechEnabled) {
                    try {
                        applyRecognitionConfig();
                        recognition.start();
                    } catch (e) {
                        // Silently fail
                    }
                }
            }, 200);
        }
    };

    applyRecognitionConfig();
    recognition.start();
}

function addToRecentWords(text) {
    const words = text.toLowerCase().split(' ').filter(w => w.length > 2);
    recentWords = [...words, ...recentWords].slice(0, 30);
}

// ==================== INTERACTION HANDLERS ====================

// Legacy single-stream flow kept for compatibility only.
// Speech fidelity + modifier transparency is handled in card/canvas voice paths.
async function interactWithVideo(spokenText) {
    console.log('🎯 interactWithVideo called');
    console.log('📝 Speech:', spokenText);
    
    if (!isStreaming) {
        console.log('⚠️ Not streaming, skipping interaction');
        return;
    }
    if (!isConnected) {
        console.log('⚠️ Not connected, skipping interaction');
        return;
    }
    
    try {
        lastVoiceInteractionTime = Date.now();
        setGeneratingIndicator(true);
        
        // Use OpenAI to generate optimal prompt (speech + audio features)
        const prompt = await generatePromptWithOpenAI(spokenText);
        
        console.log('📤 SENDING TO ODYSSEY:', prompt);
        
        const result = await odysseyClient.interact({ prompt: prompt });
        console.log('✅ Odyssey raw response:', result);
        console.log('✅ Response type:', typeof result);
        
        // Note: currentSceneState is already updated by generatePromptWithOpenAI
        // We keep the OpenAI-generated complete scene description
        // DO NOT overwrite it with Odyssey's response
        console.log('📍 Current scene state maintained:', currentSceneState.substring(0, 100) + '...');
        
        interactionCount++;
        setInteractionCountDisplay(interactionCount);
        
        // Check if hitting limits
        if (interactionCount >= 30) {
            console.warn('⚠️ Reached 30 interactions - may be hitting API limits');
        }
        
        // Store in context
        storyContext.push(prompt);
        if (storyContext.length > 10) storyContext.shift();
        
        setTimeout(() => {
            setGeneratingIndicator(false);
        }, 2000);
        
        console.log('✅ Interaction applied');
        
    } catch (error) {
        console.error('❌ Interaction error:', error);
        setGeneratingIndicator(false);
    }
}

function checkSpecialCommands(text) {
    const textUpper = text.toUpperCase();
    
    // Director commands
    if (textUpper.includes('CUT')) {
        console.log('🎬 CUT command detected');
        handleCutCommand();
        return true;
    }
    
    if (textUpper.includes('ACTION') || textUpper.includes('CONTINUE')) {
        console.log('🎬 ACTION command detected');
        handleActionCommand();
        return true;
    }
    
    if (textUpper.includes('FREEZE')) {
        console.log('❄️ FREEZE command detected');
        handleFreezeCommand();
        return true;
    }
    
    if (textUpper.includes('SLOW MOTION') || textUpper.includes('SLOW MO')) {
        console.log('🐌 SLOW MOTION command detected');
        handleSlowMotionCommand();
        return true;
    }
    
    if (textUpper.includes('SPEED UP') || textUpper.includes('FAST FORWARD')) {
        console.log('⚡ SPEED UP command detected');
        handleSpeedUpCommand();
        return true;
    }
    
    return false;
}

async function handleCutCommand() {
    isPaused = true;
    setGestureIndicator('CUT!', true);
    
    try {
        await odysseyClient.interact({ prompt: 'Freeze frame, complete stop, hold still' });
    } catch (e) {
        console.error('CUT command error:', e);
    }
}

async function handleActionCommand() {
    isPaused = false;
    setGestureIndicator('ACTION!', true, 2000);
    
    try {
        await odysseyClient.interact({ prompt: 'Resume normal movement, continue action' });
    } catch (e) {
        console.error('ACTION command error:', e);
    }
}

async function handleFreezeCommand() {
    try {
        await odysseyClient.interact({ prompt: 'Time freeze, everything stops moving, frozen moment' });
    } catch (e) {
        console.error('FREEZE command error:', e);
    }
}

async function handleSlowMotionCommand() {
    try {
        await odysseyClient.interact({ prompt: 'Slow motion effect, everything moves very slowly' });
    } catch (e) {
        console.error('SLOW MOTION command error:', e);
    }
}

async function handleSpeedUpCommand() {
    try {
        await odysseyClient.interact({ prompt: 'Fast forward, everything moves quickly, time lapse' });
    } catch (e) {
        console.error('SPEED UP command error:', e);
    }
}

async function checkDramaticAudioEvents() {
    if (isPaused || !isStreaming || !isConnected) return;
    
    // BLOCK dramatic events for 8 seconds after any intentional interaction
    const now = Date.now();
    if (now - lastVoiceInteractionTime < 8000) {
        return;
    }
    
    const { volume, volumeChange, loudDuration, quietDuration, pitch, energy } = currentAudioFeatures;
    
    // Use separate timer for audio events
    if (now - lastAudioEventTime < AUDIO_EVENT_INTERVAL) return;
    
    let dramaticPrompt = null;
    
    // Sudden loud sound (scream/explosion)
    if (volumeChange > 40 && volume > 60) {
        dramaticPrompt = 'SUDDEN SHOCK explosive dramatic impact, startling intense moment';
        console.log('💥 Sudden loud detected!');
    }
    // Sustained loud (building tension/horror)
    else if (loudDuration > 3) {
        const intensity = Math.min(loudDuration / 10, 1);
        dramaticPrompt = `Increasingly TERRIFYING and INTENSE atmosphere, building dread and horror, escalating ${intensity * 100}% intensity`;
        console.log('😱 Sustained loud - building horror!');
    }
    // Sudden quiet after loud (eerie silence)
    else if (volumeChange > 40 && volume < 20 && previousVolume > 50) {
        dramaticPrompt = 'SUDDEN SILENCE eerie quiet, unsettling calm, ominous stillness';
        console.log('🤫 Sudden silence!');
    }
    // Sustained quiet (suspense) — raised threshold to avoid false triggers
    else if (quietDuration > 10) {
        dramaticPrompt = 'SUSPENSEFUL quiet tension, anticipation building, something is about to happen';
        console.log('😰 Sustained quiet - building suspense!');
    }
    // High pitch scream
    else if (pitch === 'high' && volume > 50) {
        dramaticPrompt = 'TERRIFYING scream effect, horror moment, frightening scene';
        console.log('😱 High pitch scream!');
    }
    // Very low rumble
    else if (pitch === 'very-low' && energy > 40) {
        dramaticPrompt = 'OMINOUS deep rumbling, threatening presence, dark atmosphere';
        console.log('👹 Low rumble - ominous!');
    }
    
    if (dramaticPrompt) {
        lastAudioEventTime = now;
        
        try {
            setGeneratingIndicator(true);
            
            // Save current scene state — dramatic events should NOT overwrite it
            const savedSceneState = currentSceneState;
            
            // Use OpenAI for dramatic events too
            const prompt = await generatePromptWithOpenAI(dramaticPrompt);
            
            // Restore scene state so dramatic events don't hijack the narrative
            currentSceneState = savedSceneState;
            
            await odysseyClient.interact({ prompt: prompt });
            interactionCount++;
            setInteractionCountDisplay(interactionCount);
            
            console.log('🎭 Dramatic event sent (scene state preserved)');
            
            setTimeout(() => {
                setGeneratingIndicator(false);
            }, 1500);
            
        } catch (error) {
            console.error('Dramatic event error:', error);
        }
    }
}

// Generate prompt using OpenAI (speech + audio features only, no gestures)
async function generatePromptWithOpenAI(spokenText) {
    try {
        const { volume, pitch, energy } = currentAudioFeatures;
        
        // Build context for OpenAI - prioritize user's words!
        let systemPrompt = `You are a prompt translator for Odyssey video world.

PRIMARY RULE: Execute exactly what the user says. If they say "buildings", show buildings. If they say "red balloon", show red balloon.

Current scene: "${currentSceneState || 'Empty scene'}"

CRITICAL: You must output the COMPLETE scene description including:
1. ALL elements that were already in the scene (from "Current scene")
2. PLUS the new changes the user requested

Example:
- Current scene: "A black cat walking inside a midcentury home"
- User says: "add a penguin on the left"
- You output: "A black cat walking inside a midcentury home, with a penguin standing on the left side"

Example 2:
- Current scene: "A black cat walking inside a midcentury home, with a penguin standing on the left side"
- User says: "add a red car on the right"
- You output: "A black cat walking inside a midcentury home, with a penguin standing on the left side and a red car parked on the right"

How to interpret input:
- USER'S WORDS = highest priority, execute literally
- User's EMOTION = add appropriate adjectives to NEW objects ONLY (do NOT change locations, actions, or camera)
- Audio features = adjust intensity/mood ONLY

Output a clear, direct Odyssey prompt with the FULL scene. DO NOT add poetic language. Be literal and specific.`;

        let userPrompt = 'Input:\n';
        
        if (spokenText) {
            userPrompt += `- Speech: "${spokenText}"\n`;
        }
        
        // Add emotion context with suggested adjective
        const emotionLabel = currentEmotion || 'neutral';
        const emoji = emotionEmojis[emotionLabel] || '😐';
        const suggestedAdjective = getEmotionAdjective(emotionLabel, emotionConfidence);
        
        userPrompt += `- User Emotion: ${emoji} ${emotionLabel} at ${(emotionConfidence * 100).toFixed(0)}%\n`;
        if (suggestedAdjective) {
            userPrompt += `  Suggested adjective: "${suggestedAdjective}"\n`;
        }
        
        userPrompt += `- Volume: ${volume}% (${volume > 40 ? 'LOUD' : volume > 20 ? 'normal' : 'quiet'})\n`;
        userPrompt += `- Pitch: ${pitch} (${pitch.includes('high') ? 'bright/energetic' : pitch.includes('low') ? 'dark/serious' : 'balanced'})\n`;
        userPrompt += `- Energy: ${energy}\n`;
        
        userPrompt += `\nCreate a COMPLETE visual scene description for Odyssey (max 40 words):
- MUST include ALL existing elements from "Current scene"
- THEN add what user said: translate their words into visual action
- If emotion is provided with suggested adjective, add ONLY that adjective to NEW objects/characters mentioned
  Examples:
  • Current: "black cat in home", Speech: "add a monkey", Emotion: happy, Adjective: "cute" → "A black cat in home, with a cute monkey nearby" ✅
  • Current: "black cat and monkey", Speech: "add car on right", Emotion: angry, Adjective: "aggressive" → "A black cat and monkey in scene, with an aggressive car on the right side" ✅
  • Speech: "move the camera left", Emotion: happy → keep all elements + "move the camera left" (do NOT modify camera commands) ✅
- ONLY add emotion adjectives to NEW objects/characters (nouns), NOT to existing elements, actions, camera, or locations
- DO NOT change locations, positions, or camera movements based on emotion
- DO NOT include technical parameters
- Output the FULL scene with all elements visible

Output ONLY the visual scene description.`;
        
        debugLog('Asking OpenAI to generate prompt...');

        const data = await requestOpenAiChatCompletions({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            max_tokens: 100,
            temperature: 0.3
        });
        const generatedPrompt = data.choices[0].message.content.trim();

        debugLog('OpenAI generated prompt:', generatedPrompt);
        
        // Update current scene state for continuity
        currentSceneState = generatedPrompt;
        debugLog('Scene state updated');
        
        return generatedPrompt;
        
    } catch (error) {
        if (!isAbortError(error)) {
            console.error('❌ OpenAI error:', error);
        }
        
        // Fallback to simple prompt if OpenAI fails
        if (spokenText) {
            return spokenText;
        } else {
            return 'continue exploring';
        }
    }
}

function buildVoicePromptWithFeatures(spokenText) {
    const { volume, pitch, energy } = currentAudioFeatures;
    
    // If has text, prioritize the text content
    if (spokenText && spokenText.length > 3) {
        // Simple modifier based on volume only
        if (volume > 40) {
            return `${spokenText} with strong intensity`;
        } else if (volume > 20) {
            return spokenText; // Just use the text as-is
        } else {
            return `${spokenText} gently`;
        }
    } else {
        // No text - use audio features to control atmosphere
        let mood = '';
        
        if (volume > 40 && energy > 40) {
            mood = 'intense dramatic';
        } else if (volume > 20) {
            mood = 'moderate flowing';
        } else {
            mood = 'calm peaceful';
        }
        
        if (pitch === 'high' || pitch === 'mid-high') {
            mood += ' bright';
        } else if (pitch === 'low' || pitch === 'very-low') {
            mood += ' dark';
        }
        
        return `Camera movement ${mood} atmosphere`;
    }
}

// ==================== HAND GESTURE CONTROL ====================

async function startHandGestureTracking() {
    if (!handGestureEnabled || !isSenseRuntimeActive()) return;
    if (handTrackingAnimationFrame || handTrackingStartInFlight || handTrackerRecovering) return;
    handTrackingStartInFlight = true;

    try {
        debugLog('Starting hand gesture tracking...');

        await ensureMediaPipeReady();
        await ensureCameraFeedReady();
        if (!isHandVideoFrameReady()) {
            throw new Error('Camera video feed not ready for hand tracking');
        }
        handInferenceInFlight = false;
        let lastHandInferenceAt = 0;

        // Initialize MediaPipe Hands
        if (!hands) {
            hands = new window.Hands({
                locateFile: (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
                }
            });

            hands.setOptions({
                maxNumHands: 2,
                modelComplexity: 1,
                minDetectionConfidence: 0.4,
                minTrackingConfidence: 0.4
            });

            hands.onResults(onHandResults);
        }

        const processFrame = async () => {
            if (!hands || !handGestureEnabled || !isSenseRuntimeActive()) {
                stopHandTrackingLoop();
                return;
            }

            let continueLoop = true;
            try {
                const now = performance.now();
                const canInfer = !document.hidden && (now - lastHandInferenceAt >= HAND_TRACKING_INTERVAL_MS);

                if (canInfer && !handInferenceInFlight && isHandVideoFrameReady()) {
                    handInferenceInFlight = true;
                    lastHandInferenceAt = now;
                    try {
                        await hands.send({ image: handVideo });
                    } finally {
                        handInferenceInFlight = false;
                    }
                } else if (!isHandVideoFrameReady()) {
                    const nowMs = Date.now();
                    if (nowMs - lastCameraRecoveryAttempt > 1500) {
                        lastCameraRecoveryAttempt = nowMs;
                        ensureCameraFeedReady().catch((error) => {
                            debugLog('Hand camera recovery failed:', error.message);
                        });
                    }
                }
            } catch (error) {
                handInferenceInFlight = false;
                if (isHandTrackingFatalError(error)) {
                    continueLoop = false;
                    scheduleHandTrackerRecovery(error);
                } else {
                    debugLog('Hand frame processing failed:', error.message);
                }
            }

            if (!continueLoop || handTrackerRecovering || !handGestureEnabled || !isSenseRuntimeActive()) {
                stopHandTrackingLoop();
                return;
            }

            handTrackingAnimationFrame = requestAnimationFrame(() => {
                processFrame().catch((error) => {
                    handInferenceInFlight = false;
                    if (isHandTrackingFatalError(error)) {
                        scheduleHandTrackerRecovery(error);
                    } else {
                        debugLog('Hand tracking loop stopped:', error.message);
                        stopHandTrackingLoop();
                    }
                });
            });
        };

        camera = {
            stop: () => {
                if (handTrackingAnimationFrame) {
                    cancelAnimationFrame(handTrackingAnimationFrame);
                    handTrackingAnimationFrame = null;
                }
                handInferenceInFlight = false;
            }
        };

        handTrackingAnimationFrame = requestAnimationFrame(() => {
            processFrame().catch((error) => {
                handInferenceInFlight = false;
                if (isHandTrackingFatalError(error)) {
                    scheduleHandTrackerRecovery(error);
                } else {
                    debugLog('Hand tracking start failed:', error.message);
                    stopHandTrackingLoop();
                }
            });
        });

        debugLog('Hand gesture tracking started');

    } catch (error) {
        if (isHandTrackingFatalError(error)) {
            scheduleHandTrackerRecovery(error);
            return;
        }
        if (String(error?.message || '').toLowerCase().includes('not ready for hand tracking')) {
            setTimeout(() => {
                if (handGestureEnabled && isSenseRuntimeActive()) {
                    startHandGestureTracking().catch((retryError) => {
                        debugLog('Hand tracking delayed retry failed:', retryError?.message || retryError);
                    });
                }
            }, 300);
            return;
        }
        console.error('Hand tracking error:', error);
        throw error;
    } finally {
        handTrackingStartInFlight = false;
    }
}

function onHandResults(results) {
    if (!handCanvas || !handVideo) return;

    const videoWidth = Number(handVideo.videoWidth || 0);
    const videoHeight = Number(handVideo.videoHeight || 0);
    if (videoWidth < HAND_VIDEO_MIN_DIMENSION_PX || videoHeight < HAND_VIDEO_MIN_DIMENSION_PX) {
        const fallbackCtx = handCanvas.getContext('2d');
        if (fallbackCtx) {
            fallbackCtx.clearRect(0, 0, handCanvas.width, handCanvas.height);
        }
        return;
    }

    // Keep overlay canvas synced to real video dimensions.
    if (handCanvas.width !== videoWidth || handCanvas.height !== videoHeight) {
        handCanvas.width = videoWidth;
        handCanvas.height = videoHeight;
    }

    const canvasCtx = handCanvas.getContext('2d');
    if (!canvasCtx) return;
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, handCanvas.width, handCanvas.height);
    
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0 && results.multiHandedness) {
        let selectedPointing = null;
        let selectedPinch = null;
        let selectedGrab = null;
        let selectedPinchDistance = Infinity;
        let closestPinchLandmarks = null;
        let closestPinchDistance = Infinity;
        let firstReliableLandmarks = null;
        let selectedGesture = null;
        let reliableHandDetected = false;

        for (let i = 0; i < results.multiHandLandmarks.length; i++) {
            const landmarks = results.multiHandLandmarks[i];
            const confidence = results.multiHandedness[i]?.score || 0;
            if (confidence < HAND_SCORE_THRESHOLD) {
                continue;
            }
            reliableHandDetected = true;
            if (!firstReliableLandmarks) {
                firstReliableLandmarks = landmarks;
            }

            // Draw hand skeleton
            window.drawConnectors(canvasCtx, landmarks, window.HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 3 });
            window.drawLandmarks(canvasCtx, landmarks, { color: '#FF0000', lineWidth: 2, radius: 5 });

            const gesture = recognizeGesture(landmarks);
            if (!selectedGesture && gesture) {
                selectedGesture = gesture;
            }

            const pinchDistance = getPinchDistance(landmarks);
            if (pinchDistance < closestPinchDistance) {
                closestPinchDistance = pinchDistance;
                closestPinchLandmarks = landmarks;
            }
            if (pinchDistance <= PINCH_START_DISTANCE && pinchDistance < selectedPinchDistance) {
                selectedPinch = landmarks;
                selectedPinchDistance = pinchDistance;
            }
            if (!selectedGrab && isGrabPose(landmarks)) {
                selectedGrab = landmarks;
            }

            if (!selectedPointing) {
                const pointerDetected = isPointingPose(landmarks) || (typeof gesture === 'string' && gesture.includes('Pointing'));
                if (pointerDetected) {
                    selectedPointing = landmarks;
                }
            }
        }

        if (!reliableHandDetected) {
            handMissedFrames += 1;
            if (handMissedFrames > HAND_MISS_TOLERANCE_FRAMES) {
                currentGesture = null;
                endPinchDrag();
                clearPointingGestureState();
                setGestureIndicator('', false);
            }
            canvasCtx.restore();
            return;
        }

        handMissedFrames = 0;

        // Pinch has priority over grab and pointing to avoid gesture conflicts.
        if (selectedPinch || pinchDragState?.dragType === 'pinch') {
            const activeLandmarks = selectedPinch || (pinchDragState ? closestPinchLandmarks : null);
            const pinchDistance = selectedPinch ? selectedPinchDistance : closestPinchDistance;
            const pinchReleaseThreshold = PINCH_RELEASE_DISTANCE + (pinchDragState ? PINCH_RELEASE_GRACE_DISTANCE : 0);
            const pinchClosingDelta = (
                Number.isFinite(lastPinchDistanceSample) &&
                Number.isFinite(pinchDistance)
            ) ? (lastPinchDistanceSample - pinchDistance) : 0;
            const pinchStartThreshold = PINCH_START_DISTANCE + PINCH_START_ASSIST_DISTANCE;
            const pinchStartSignal =
                !!activeLandmarks &&
                (
                    pinchDistance <= PINCH_START_DISTANCE ||
                    (pinchDistance <= pinchStartThreshold && pinchClosingDelta >= PINCH_CLOSE_DELTA_THRESHOLD)
                );

            if (pinchStartSignal) {
                pinchDetectedFrames += 1;
            } else {
                pinchDetectedFrames = 0;
            }

            if (activeLandmarks && pinchDistance <= pinchReleaseThreshold) {
                pinchReleaseFrames = 0;
            } else if (pinchDragState) {
                pinchReleaseFrames += 1;
            } else {
                pinchReleaseFrames = 0;
            }

            if (isPointing) {
                clearPointingGestureState({ keepCursor: true });
            }

            const shouldContinuePinch =
                !!activeLandmarks &&
                (pinchDistance <= pinchReleaseThreshold || (pinchDragState && pinchReleaseFrames <= PINCH_RELEASE_TOLERANCE_FRAMES));

            if (shouldContinuePinch) {
                const stabilizedPinchPoint = getStabilizedPinchViewportPoint(activeLandmarks);
                const thumbPoint = getViewportPointFromLandmark(activeLandmarks[4]);
                const indexPoint = getViewportPointFromLandmark(activeLandmarks[8]);
                const fallbackPinchX = (thumbPoint.x + indexPoint.x) * 0.5;
                const fallbackPinchY = (thumbPoint.y + indexPoint.y) * 0.5;
                const pinchX = Number.isFinite(stabilizedPinchPoint?.x) ? stabilizedPinchPoint.x : fallbackPinchX;
                const pinchY = Number.isFinite(stabilizedPinchPoint?.y) ? stabilizedPinchPoint.y : fallbackPinchY;

                renderHandPresenceCursorAtViewport(pinchX, pinchY, 'pinching');

                if (!pinchDragState) {
                    if (pinchDetectedFrames >= PINCH_STABLE_FRAMES) {
                        beginPinchDrag(pinchX, pinchY, 'pinch');
                    }
                } else if (pinchDragState.dragType === 'pinch') {
                    updatePinchDrag(pinchX, pinchY);
                }

                currentGesture = 'Pinch Drag';
            } else {
                endPinchDrag();
                if (selectedPointing) {
                    handlePointingFromLandmarks(selectedPointing);
                    currentGesture = selectedGesture || 'Pointing';
                } else {
                    clearPointingGestureState({ keepCursor: true });
                    if (firstReliableLandmarks) {
                        renderHandPresenceCursorFromLandmarks(firstReliableLandmarks, 'neutral');
                    }
                    currentGesture = selectedGesture;
                    if (!pinchDragState) {
                        setGestureIndicator('', false);
                    }
                }
            }
            lastPinchDistanceSample = Number.isFinite(pinchDistance) ? pinchDistance : Infinity;
        } else if ((selectedGrab && !selectedPointing) || pinchDragState?.dragType === 'grab') {
            const activeLandmarks = selectedGrab || (pinchDragState?.dragType === 'grab' ? firstReliableLandmarks : null);
            const grabDetectedNow = !!selectedGrab;

            if (grabDetectedNow) {
                grabDetectedFrames += 1;
                grabReleaseFrames = 0;
            } else {
                grabDetectedFrames = 0;
                if (pinchDragState?.dragType === 'grab') {
                    grabReleaseFrames += 1;
                } else {
                    grabReleaseFrames = 0;
                }
            }

            if (isPointing) {
                clearPointingGestureState({ keepCursor: true });
            }

            const shouldContinueGrab =
                !!activeLandmarks &&
                (grabDetectedNow || (pinchDragState?.dragType === 'grab' && grabReleaseFrames <= GRAB_RELEASE_TOLERANCE_FRAMES));

            if (shouldContinueGrab) {
                const grabPoint = getGrabAnchorViewportPoint(activeLandmarks);
                if (grabPoint) {
                    renderHandPresenceCursorAtViewport(grabPoint.x, grabPoint.y, 'pinching');
                    if (!pinchDragState) {
                        if (grabDetectedFrames >= GRAB_STABLE_FRAMES) {
                            beginPinchDrag(grabPoint.x, grabPoint.y, 'grab');
                        }
                    } else if (pinchDragState.dragType === 'grab') {
                        updatePinchDrag(grabPoint.x, grabPoint.y);
                    }
                    currentGesture = 'Grab Drag';
                } else {
                    currentGesture = selectedGesture || 'Grab';
                }
            } else {
                endPinchDrag();
                if (selectedPointing) {
                    handlePointingFromLandmarks(selectedPointing);
                    currentGesture = selectedGesture || 'Pointing';
                } else {
                    clearPointingGestureState({ keepCursor: true });
                    if (firstReliableLandmarks) {
                        renderHandPresenceCursorFromLandmarks(firstReliableLandmarks, 'neutral');
                    }
                    currentGesture = selectedGesture;
                    if (!pinchDragState) {
                        setGestureIndicator('', false);
                    }
                }
            }
            lastPinchDistanceSample = Number.isFinite(closestPinchDistance) ? closestPinchDistance : Infinity;
        } else if (selectedPointing) {
            endPinchDrag();
            handlePointingFromLandmarks(selectedPointing);
            currentGesture = selectedGesture || 'Pointing';
            lastPinchDistanceSample = Number.isFinite(closestPinchDistance) ? closestPinchDistance : Infinity;
        } else {
            endPinchDrag();
            currentGesture = selectedGesture;
            clearPointingGestureState({ keepCursor: true });
            if (firstReliableLandmarks) {
                renderHandPresenceCursorFromLandmarks(firstReliableLandmarks, 'neutral');
            }
            setGestureIndicator('', false);
            lastPinchDistanceSample = Number.isFinite(closestPinchDistance) ? closestPinchDistance : Infinity;
        }
    } else {
        handMissedFrames += 1;
        if (handMissedFrames <= HAND_MISS_TOLERANCE_FRAMES) {
            canvasCtx.restore();
            return;
        }
        currentGesture = null;
        endPinchDrag();
        clearPointingGestureState();
        resetHandCursorMotionState();
        lastPinchDistanceSample = Infinity;
        setGestureIndicator('', false);
    }
    
    canvasCtx.restore();
}

function handlePointingFromLandmarks(landmarks) {
    if (!landmarks || landmarks.length < 9) {
        clearPointingGestureState();
        return;
    }

    const indexTip = landmarks[8];
    const rawViewportPoint = getViewportPointFromLandmark(indexTip);
    const viewportPoint = getSmoothedHandCursorPoint(rawViewportPoint.x, rawViewportPoint.y, 'pointing');
    lastPointAimViewport = { x: viewportPoint.x, y: viewportPoint.y };
    lastPointAimTimestamp = Date.now();
    const hoveredCardId = getCardIdAtViewportPoint(viewportPoint.x, viewportPoint.y);
    const hoveredAnyCardId = getCardIdAtViewportPoint(viewportPoint.x, viewportPoint.y, true);
    hoverPointerCardId = hoveredCardId;

    if (!isPointing) {
        isPointing = true;
    }

    // Prime microphone/recognizer as soon as pointing is active.
    primeVoiceRuntimeForPointing();

    // Keep pointing active globally, but only render cursor when inside a card.
    if (!hoveredCardId) {
        setDotHoverCard(null);
        hideInactiveFingerCursors(null);
        showGlobalHandCursor(viewportPoint.x, viewportPoint.y, 'pointing');

        const shouldShowCanvasPrompt =
            !promptSpawnInFlight &&
            !hoveredAnyCardId &&
            isViewportPointEligibleForCanvasVoicePrompt(viewportPoint.x, viewportPoint.y);
        updateCanvasVoicePromptTracking(viewportPoint.x, viewportPoint.y, shouldShowCanvasPrompt);

        setGestureIndicator('Pointing', true);
        return;
    }

    hideCanvasVoicePrompt();

    const context = getInteractionContext(hoveredCardId);
    const targetDisplayEl = context?.displayEl;
    if (!targetDisplayEl) {
        return;
    }

    const rect = targetDisplayEl.getBoundingClientRect();
    if (!rect.width || !rect.height) {
        return;
    }

    const localX = Math.max(0, Math.min(1, (viewportPoint.x - rect.left) / rect.width));
    const localY = Math.max(0, Math.min(1, (viewportPoint.y - rect.top) / rect.height));
    setDotHoverCard(hoveredCardId);
    hideGlobalHandCursor();

    fingerCursorPos.x = localX;
    fingerCursorPos.y = localY;
    updateFingerCursor(context, true, 'pointing');
    updateCardVoiceAim(hoveredCardId, localX, localY, 'pointing');
    if (isStreamCardActiveForVoiceEdits(hoveredCardId)) {
        setActiveStream('secondary', hoveredCardId);
    }
}

function recognizeGesture(landmarks) {
    // Get key points
    const thumb = landmarks[4];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];
    const wrist = landmarks[0];
    const indexBase = landmarks[5];
    
    // Helper: check if finger is extended
    const isExtended = (tip, base) => tip.y < base.y;
    
    const thumbExtended = thumb.x < landmarks[3].x; // Thumb logic different
    const indexExtended = isExtended(indexTip, indexBase);
    const middleExtended = isExtended(middleTip, landmarks[9]);
    const ringExtended = isExtended(ringTip, landmarks[13]);
    const pinkyExtended = isExtended(pinkyTip, landmarks[17]);
    
    // Recognize specific gestures
    
    // 👍 Thumbs up
    if (thumbExtended && !indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
        return '👍 Thumbs Up';
    }
    
    // ✋ Open palm (all fingers extended)
    if (indexExtended && middleExtended && ringExtended && pinkyExtended) {
        return '✋ Open Palm';
    }
    
    // ✊ Fist (all fingers closed)
    if (!indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
        return '✊ Fist';
    }
    
    // ☝️ Pointing (only index extended)
    if (indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
        return '☝️ Pointing';
    }
    
    // ✌️ Peace sign (index + middle)
    if (indexExtended && middleExtended && !ringExtended && !pinkyExtended) {
        return '✌️ Peace';
    }
    
    // 🤘 Rock (index + pinky)
    if (indexExtended && !middleExtended && !ringExtended && pinkyExtended) {
        return '🤘 Rock';
    }
    
    // 🤏 Pinch (thumb + index close together)
    const distance = Math.sqrt(
        Math.pow(thumb.x - indexTip.x, 2) + 
        Math.pow(thumb.y - indexTip.y, 2)
    );
    if (distance < PINCH_START_DISTANCE) {
        return '🤏 Pinch';
    }
    
    return null;
}

function isPointingPose(landmarks) {
    if (!Array.isArray(landmarks) || landmarks.length < 21) return false;

    const indexTip = landmarks[8];
    const indexPip = landmarks[6];
    const indexMcp = landmarks[5];
    const middleTip = landmarks[12];
    const middlePip = landmarks[10];
    const ringTip = landmarks[16];
    const ringPip = landmarks[14];
    const pinkyTip = landmarks[20];
    const pinkyPip = landmarks[18];

    const indexExtended = (indexTip.y + 0.01 < indexPip.y) && (indexPip.y + 0.005 < indexMcp.y);
    const middleCurled = middleTip.y > middlePip.y - 0.005;
    const ringCurled = ringTip.y > ringPip.y - 0.005;
    const pinkyCurled = pinkyTip.y > pinkyPip.y - 0.005;
    const indexClearlyLeading = indexTip.y < middleTip.y - 0.03;

    return indexExtended && middleCurled && ringCurled && pinkyCurled && indexClearlyLeading;
}

// Removed standalone gesture handler - gestures now collected with speech

// ==================== FINGER CURSOR & DWELL-CLICK + VOICE GROUNDING ====================

function updateFingerCursor(contextOverride = null, showPointingIndicator = true, mode = 'neutral') {
    const preferredCardId = contextOverride?.cardId || hoverPointerCardId || lastClickTargetCardId;
    const context = contextOverride || getInteractionContext(preferredCardId);
    const targetCursorEl = context?.fingerCursorEl;
    const targetDisplayEl = context?.displayEl;
    if (!targetCursorEl || !targetDisplayEl) return;

    const rect = targetDisplayEl.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const px = fingerCursorPos.x * rect.width;
    const py = fingerCursorPos.y * rect.height;

    hideInactiveFingerCursors(targetCursorEl);
    targetCursorEl.style.left = px + 'px';
    targetCursorEl.style.top = py + 'px';
    setCursorVisualMode(targetCursorEl, mode);
    targetCursorEl.classList.add('active');

    // Global gesture chip (outside cards)
    if (showPointingIndicator) {
        setGestureIndicator('Pointing', true);
    }
}

function hideFingerCursor() {
    hideInactiveFingerCursors(null);
    hideGlobalHandCursor();
    setDotHoverCard(null);
    if ((gestureIndicator?.textContent || '').includes('Pointing')) {
        setGestureIndicator('', false);
    }
}

function handleFingerClick(xNorm, yNorm, contextOverride = null) {
    const context = contextOverride || getInteractionContext();
    if (!context?.displayEl || !context?.videoEl) return;

    lastClickTargetCardId = context.cardId && context.cardId !== 'primary' ? context.cardId : null;
    hoverPointerCardId = lastClickTargetCardId;
    if (lastClickTargetCardId) {
        setActiveStream('secondary', lastClickTargetCardId);
    }

    // Keep a fresh grounding anchor for hover/speech edits.
    updateCardVoiceAim(lastClickTargetCardId, xNorm, yNorm, 'click');
    lastClickFrameData = captureSelectionFrames(xNorm, yNorm, context.videoEl);
    visionResult = null;
    temporaryMuteUntil = 0;
    primeVoiceRuntimeForPointing();
    hideAllVoicePromptPanels();
}

async function handleCanvasPointedPrompt(spokenText, options = {}) {
    const onMetaUpdate = typeof options.onMetaUpdate === 'function' ? options.onMetaUpdate : null;
    const text = String(spokenText || '').trim();
    if (!text || promptSpawnInFlight) {
        return null;
    }

    let spawnCanvasPoint = null;
    if (isCanvasVoicePromptListeningContext()) {
        spawnCanvasPoint = {
            x: emptyCanvasVoicePromptState.canvasX,
            y: emptyCanvasVoicePromptState.canvasY
        };
    } else {
        const fallback = seedCanvasVoicePromptTrackingFromRecentPointing();
        if (fallback) {
            spawnCanvasPoint = {
                x: fallback.canvasX,
                y: fallback.canvasY
            };
        }
    }

    if (!spawnCanvasPoint) {
        return null;
    }

    const modifierResult = applySpeechPromptModifiers(text, {
        includeEmotion: true,
        includeAudio: true,
        audioFeatures: currentAudioFeatures
    });
    const appliedPrompt = modifierResult.prompt || text;

    onMetaUpdate?.({
        route: 'canvas-create',
        stage: 'post-modifier',
        appliedText: appliedPrompt,
        locationRewrite: false,
        emotionApplied: modifierResult.emotionApplied,
        audioApplied: modifierResult.audioApplied
    });

    emptyCanvasVoicePromptState.locked = true;
    updateCanvasVoicePromptText(appliedPrompt, { mode: 'speech' });
    showCanvasVoicePromptAtTrackedPoint();

    try {
        await submitPromptAsNewCard(appliedPrompt, {
            spawnCanvasPoint,
            skipPromptRewrite: true,
            rawText: text,
            auditRoute: 'voice-canvas-create',
            auditModifiers: {
                emotion: modifierResult.emotionApplied,
                audio: modifierResult.audioApplied,
                asr: !!latestSpeechMeta?.asr?.usedAlternative
            }
        });
        return {
            appliedPrompt,
            route: 'canvas-create',
            locationApplied: false,
            emotionApplied: modifierResult.emotionApplied,
            audioApplied: modifierResult.audioApplied
        };
    } catch (error) {
        console.error('Canvas pointed prompt error:', error);
        return null;
    } finally {
        hideCanvasVoicePrompt();
    }
}

// Called from speech recognition when we're in waiting-for-voice-prompt mode
function getVoiceGroundingPointForCard(cardId) {
    const recentAim = getRecentCardVoiceAim(cardId);
    if (recentAim) {
        return recentAim;
    }
    return { xNorm: 0.5, yNorm: 0.5 };
}

async function handleVoiceGroundedPrompt(spokenText, preferredCardId = null, options = {}) {
    const onMetaUpdate = typeof options.onMetaUpdate === 'function' ? options.onMetaUpdate : null;
    const rawText = String(spokenText || '').trim();
    if (!rawText) return null;

    const targetCardId = getStreamingPromptTargetCardId(
        preferredCardId || hoverPointerCardId || dotHoverCardId || mouseHoverCardId || activeStreamCardId || lastClickTargetCardId || null
    );
    if (!targetCardId) return null;

    const cardState = streamCards.get(targetCardId);
    if (!cardState || cardState.isPromptSubmitting) return null;
    if (Number.isFinite(cardState.skipNextVoiceCommitUntil) && cardState.skipNextVoiceCommitUntil > Date.now()) {
        cardState.skipNextVoiceCommitUntil = 0;
        return null;
    }

    temporaryMuteUntil = 0;
    hideAllVoicePromptPanels();
    cardState.isPromptSubmitting = true;
    syncCardPromptDockState(cardState);

    try {
        const aim = getVoiceGroundingPointForCard(targetCardId);
        updateCardVoiceAim(targetCardId, aim.xNorm, aim.yNorm, 'speech');
        const context = getInteractionContext(targetCardId);

        lastClickTargetCardId = targetCardId;
        lastClickPos = { xPercent: aim.xNorm, yPercent: aim.yNorm };
        lastClickFrameData = captureSelectionFrames(aim.xNorm, aim.yNorm, context?.videoEl || cardState.videoEl);
        visionResult = null;

        let finalPrompt = rawText;
        let locationApplied = false;
        let emotionApplied = false;
        let audioApplied = false;

        if (hasOpenAiTransport() && lastClickFrameData) {
            const grounded = await getVisionGroundedPrompt(rawText);
            finalPrompt = grounded.prompt || rawText;
            locationApplied = !!grounded.locationApplied;
        } else if (lastClickPos) {
            const grounded = composeFallbackPromptWithMetadata(rawText);
            finalPrompt = grounded.prompt || rawText;
            locationApplied = !!grounded.locationApplied;
        }

        onMetaUpdate?.({
            route: 'card-edit',
            stage: 'post-location',
            appliedText: finalPrompt,
            locationRewrite: locationApplied
        });

        const modifierResult = applySpeechPromptModifiers(finalPrompt, {
            includeEmotion: true,
            includeAudio: true,
            audioFeatures: currentAudioFeatures
        });
        finalPrompt = modifierResult.prompt || finalPrompt;
        emotionApplied = modifierResult.emotionApplied;
        audioApplied = modifierResult.audioApplied;

        onMetaUpdate?.({
            route: 'card-edit',
            stage: 'post-modifier',
            appliedText: finalPrompt,
            locationRewrite: locationApplied,
            emotionApplied,
            audioApplied
        });

        updateDraftSpeechChipText(cardState, finalPrompt);
        setGeneratingIndicator(true);
        await applyPromptToCard(targetCardId, finalPrompt, {
            rawText,
            route: 'voice-card-edit',
            modifiers: {
                location: locationApplied,
                emotion: emotionApplied,
                audio: audioApplied,
                asr: !!latestSpeechMeta?.asr?.usedAlternative
            }
        });
        commitDraftChip(cardState, finalPrompt, { source: 'voice' });

        interactionCount++;
        setInteractionCountDisplay(interactionCount);
        currentSceneState = finalPrompt;
        storyContext.push(finalPrompt);
        if (storyContext.length > 10) storyContext.shift();
        return {
            appliedPrompt: finalPrompt,
            route: 'card-edit',
            locationApplied,
            emotionApplied,
            audioApplied
        };
    } catch (error) {
        console.error('Voice grounded prompt error:', error);
        if (cardState.pendingSpeechChipId) {
            removeCardPromptChip(cardState, cardState.pendingSpeechChipId);
            setCardActiveChip(cardState, getLastCommittedChip(cardState)?.id || null);
        }
        return null;
    } finally {
        cardState.isPromptSubmitting = false;
        syncCardPromptDockState(cardState);
        setGeneratingIndicator(false);
    }
}

function captureSelectionFrames(xNorm, yNorm, videoSource = null) {
    try {
        const sourceVideo = videoSource || getInteractionContext(lastClickTargetCardId)?.videoEl || videoElement;
        if (!sourceVideo || sourceVideo.readyState < 2) {
            return null;
        }

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const vw = sourceVideo.videoWidth || 1280;
        const vh = sourceVideo.videoHeight || 720;
        
        // 1. Full frame with red click marker
        canvas.width = vw;
        canvas.height = vh;
        ctx.drawImage(sourceVideo, 0, 0, vw, vh);
        
        const markerX = xNorm * vw;
        const markerY = yNorm * vh;
        ctx.beginPath();
        ctx.arc(markerX, markerY, 18, 0, Math.PI * 2);
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(markerX, markerY, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#ff0000';
        ctx.fill();
        
        const fullFrame = canvas.toDataURL('image/jpeg', 0.85);
        
        // 2. Zoom crop around click (25% of frame centered on click)
        const cropSize = Math.min(vw, vh) * 0.25;
        const cropX = Math.max(0, Math.min(vw - cropSize, markerX - cropSize / 2));
        const cropY = Math.max(0, Math.min(vh - cropSize, markerY - cropSize / 2));
        
        const zoomCanvas = document.createElement('canvas');
        zoomCanvas.width = 512;
        zoomCanvas.height = 512;
        const zCtx = zoomCanvas.getContext('2d');
        zCtx.drawImage(sourceVideo, cropX, cropY, cropSize, cropSize, 0, 0, 512, 512);
        
        const zMarkerX = ((markerX - cropX) / cropSize) * 512;
        const zMarkerY = ((markerY - cropY) / cropSize) * 512;
        zCtx.beginPath();
        zCtx.arc(zMarkerX, zMarkerY, 12, 0, Math.PI * 2);
        zCtx.strokeStyle = '#ff0000';
        zCtx.lineWidth = 3;
        zCtx.stroke();
        
        const zoomFrame = zoomCanvas.toDataURL('image/jpeg', 0.9);
        
        debugLog('Captured full frame + zoom crop');
        return { fullFrame, zoomFrame };
        
    } catch (error) {
        console.error('❌ Frame capture error:', error);
        return null;
    }
}

async function getVisionGroundedPrompt(userPrompt) {
    const fallbackGrounding = composeFallbackPromptWithMetadata(userPrompt);

    if (!hasOpenAiTransport()) {
        console.warn('⚠️ No OpenAI key, using fallback');
        return fallbackGrounding;
    }
    
    if (!lastClickFrameData) {
        console.warn('⚠️ No frame data, using fallback');
        return fallbackGrounding;
    }
    
    // If we already have pre-analyzed scene and it's high confidence,
    // skip the second vision call and compose directly
    if (visionResult && visionResult.confidence >= 0.7 && visionResult.locationHint) {
        debugLog('Using pre-analyzed scene for fast grounding');
        const grounded = applyLocationHintToPrompt(userPrompt, visionResult.locationHint);
        debugLog('Composed prompt:', grounded.prompt);
        return grounded.locationApplied ? grounded : fallbackGrounding;
    }

    if (visionGroundAbortController) {
        visionGroundAbortController.abort();
    }
    const requestController = new AbortController();
    visionGroundAbortController = requestController;
    
    try {
        const { xPercent, yPercent } = lastClickPos;
        
        // Build scene context from pre-analysis if available
        let sceneContext = '';
        if (visionResult) {
            sceneContext = `\n\nPre-analysis of click point:
- At click: "${visionResult.selection || 'unknown'}"
- Frame position: "${visionResult.framePosition || 'unknown'}"
- Depth: "${visionResult.depth || 'unknown'}"
- Relative to subject: "${visionResult.relativeToSubject || 'unknown'}"
- Location hint: "${visionResult.locationHint || 'unknown'}"
- Nearby anchor: "${visionResult.nearbyAnchor || 'unknown'}"
- Scene: "${visionResult.sceneDescription || currentSceneState || 'unknown'}"
Use ALL these spatial details to write the MOST precise prompt rewrite possible.`;
        }
        
        const systemPrompt = `You analyze a video frame where the user pointed (marked with a red circle) and rewrite their voice command into a precise, scene-grounded prompt for a video AI.

Return ONLY valid JSON:
{
  "selection": "what is at the click point (1-3 words)",
  "locationHint": "detailed spatial description from multiple perspectives",
  "framePosition": "position in frame (e.g. 'left foreground', 'right background')",
  "relativeToSubject": "position relative to main subject/person if visible",
  "depth": "depth in scene (foreground/middle-ground/background)",
  "nearbyAnchor": "closest recognizable object near the click",
  "confidence": 0.0-1.0,
  "promptRewrite": "the user's intent rewritten with EXACT multi-dimensional scene location"
}

CRITICAL rules for promptRewrite:
- PRESERVE the user's intent exactly (if they say "add a car", the rewrite must add a car)
- REPLACE vague words (here/there/this) with LAYERED spatial descriptions
- Use MULTIPLE spatial references:
  * Frame position: "in the left foreground", "right background"
  * Depth: "in the foreground", "far background"
  * Relative to subjects: "to the man's right", "behind the runner"
  * Landmarks: "beside the tree", "on the road"
- NEVER use grid language like "left area", "upper portion"
- Example good rewrites:
  ✓ "add a car on the dirt road in the left foreground, to the right of the running man"
  ✓ "place a tree in the background on the right side, behind the existing trees"
- The rewrite must specify WHERE in 3D space (left/right + depth + relative)
- Keep under 35 words${sceneContext}`;

        const userContent = [
            {
                type: 'image_url',
                image_url: { url: lastClickFrameData.fullFrame, detail: 'low' }
            },
            {
                type: 'image_url',
                image_url: { url: lastClickFrameData.zoomFrame, detail: 'high' }
            },
            {
                type: 'text',
                text: `User pointed at (${(xPercent * 100).toFixed(0)}%, ${(yPercent * 100).toFixed(0)}%) and said: "${userPrompt}"\n\nRewrite their prompt with exact scene-aware location.`
            }
        ];
        
        debugLog('Calling OpenAI vision for scene-grounded rewrite...');

        const data = await requestOpenAiChatCompletions({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userContent }
            ],
            max_tokens: 250,
            temperature: 0.15
        }, {
            timeoutMs: OPENAI_FETCH_TIMEOUT_MS + 6000,
            signal: requestController.signal,
            retries: OPENAI_FETCH_RETRIES
        });

        if (requestController.signal.aborted || visionGroundAbortController !== requestController) {
            return fallbackGrounding;
        }

        const raw = data.choices[0].message.content.trim();
        
        const clean = raw.replace(/```json|```/g, '').trim();
        const result = JSON.parse(clean);
        
        // Update visionResult with the richer data
        visionResult = { ...visionResult, ...result };
        
        debugLog('Vision grounded result:', visionResult);
        
        // Location-only policy: ignore free-form promptRewrite.
        const locationHint = result.locationHint || (visionResult && visionResult.locationHint);
        if (locationHint) {
            const grounded = applyLocationHintToPrompt(userPrompt, locationHint);
            return grounded.locationApplied ? grounded : fallbackGrounding;
        }
        
        return fallbackGrounding;
        
    } catch (error) {
        if (isAbortError(error)) {
            return fallbackGrounding;
        }
        console.error('Vision grounding error:', error);
        
        // If pre-analysis exists, use it as fallback
        if (visionResult && visionResult.locationHint) {
            debugLog('Falling back to pre-analyzed scene data');
            const grounded = applyLocationHintToPrompt(userPrompt, visionResult.locationHint);
            return grounded.locationApplied ? grounded : fallbackGrounding;
        }
        
        return fallbackGrounding;
    } finally {
        if (visionGroundAbortController === requestController) {
            visionGroundAbortController = null;
        }
    }
}

function containsGridLanguage(text) {
    const gridTerms = ['middle-left', 'top-right', 'bottom-center', 'upper-left', 'lower-right', 'center area', 'left area', 'right area'];
    const lower = text.toLowerCase();
    return gridTerms.some(t => lower.includes(t));
}

function composeWithSceneLocation(userPrompt, locationHint) {
    return applyLocationHintToPrompt(userPrompt, locationHint).prompt;
}

function composeFallbackPromptWithMetadata(userPrompt) {
    const basePrompt = String(userPrompt || '').trim();
    if (!lastClickPos) {
        return {
            prompt: basePrompt,
            locationApplied: false,
            locationHint: ''
        };
    }
    
    const { xPercent, yPercent } = lastClickPos;
    
    const xDesc = xPercent < 0.33 ? 'on the left side' : xPercent > 0.66 ? 'on the right side' : 'in the center';
    const yDesc = yPercent < 0.33 ? 'at the top' : yPercent > 0.66 ? 'at the bottom' : 'in the middle';
    const hint = `${xDesc} ${yDesc} of the scene`;
    return applyLocationHintToPrompt(basePrompt, hint);
}

function composeFallbackPrompt(userPrompt) {
    return composeFallbackPromptWithMetadata(userPrompt).prompt;
}

// ==================== FACE EMOTION DETECTION ====================

async function startFaceDetection() {
    if (faceDetectionStartInFlight) {
        return;
    }
    faceDetectionStartInFlight = true;

    try {
    if (!faceDetectionEnabled || !isSenseRuntimeActive()) {
        return;
    }

    if (faceDetectionInterval) {
        return;
    }

    try {
        await ensureFaceApiReady();
    } catch (error) {
        console.error('Face-api failed to load:', error);
        return;
    }

    try {
        console.log('Starting face emotion detection...');

        // Use the same handVideo element that's already capturing camera
        const video = await ensureCameraFeedReady();
        const canvas = faceCanvas;

        // Wait for video to be ready
        if (video.readyState < 2) {
            await new Promise((resolve) => {
                const checkReady = setInterval(() => {
                    if (video.readyState >= 2 && video.videoWidth > 0) {
                        clearInterval(checkReady);
                        resolve();
                    }
                }, 100);
                setTimeout(() => {
                    clearInterval(checkReady);
                    resolve();
                }, 5000);
            });
        }

        if (video.videoWidth === 0 || video.videoHeight === 0) {
            console.error('Video has no dimensions, cannot start face detection');
            return;
        }

        const displaySize = { width: video.videoWidth, height: video.videoHeight };
        faceapi.matchDimensions(canvas, displaySize);

        const detectFace = async () => {
            if (!faceDetectionEnabled || !isSenseRuntimeActive()) {
                faceDetectionInterval = null;
                return;
            }

            if (document.hidden) {
                faceDetectionInterval = setTimeout(detectFace, FACE_DETECTION_INTERVAL_MS);
                return;
            }

            try {
                const detections = await faceapi
                    .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({
                        inputSize: 160,
                        scoreThreshold: 0.35
                    }))
                    .withFaceExpressions();

                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);

                if (detections) {
                    const resizedDetections = faceapi.resizeResults(detections, displaySize);
                    const box = resizedDetections.detection.box;

                    ctx.strokeStyle = '#ff0000';
                    ctx.lineWidth = 3;
                    ctx.strokeRect(box.x, box.y, box.width, box.height);

                    const expressions = detections.expressions;
                    let maxEmotion = 'neutral';
                    let maxScore = 0;

                    for (const [emotion, score] of Object.entries(expressions)) {
                        if (score > maxScore) {
                            maxScore = score;
                            maxEmotion = emotion;
                        }
                    }

                    if (maxScore > 0.3) {
                        currentEmotion = maxEmotion;
                        emotionConfidence = maxScore;

                        const emoji = emotionEmojis[maxEmotion] || ':|';
                        const percent = Math.round(maxScore * 100);

                        if (emotionEmojiEl) emotionEmojiEl.textContent = emoji;
                        if (emotionLabelEl) emotionLabelEl.textContent = maxEmotion;
                        if (emotionPercentEl) emotionPercentEl.textContent = percent + '%';
                        if (emotionValueEl) emotionValueEl.textContent = `${emoji} ${maxEmotion}`;
                        applyEmotionColors(maxEmotion);
                    }
                }
            } catch (err) {
                console.error('Face detection error:', err);
            }

            if (faceDetectionEnabled && isSenseRuntimeActive()) {
                faceDetectionInterval = setTimeout(detectFace, FACE_DETECTION_INTERVAL_MS);
            } else {
                faceDetectionInterval = null;
            }
        };

        detectFace();
        console.log('Face emotion detection started');

    } catch (error) {
        faceDetectionInterval = null;
        console.error('Face detection setup error:', error);
    }
    } finally {
        faceDetectionStartInFlight = false;
    }
}

// ==================== CLEANUP ====================

function disconnectAllOdysseyClientsSync(reason = 'cleanup') {
    recordStreamTelemetry('odyssey_cleanup', { reason, cards: streamCards.size });
    cancelScheduledProjectAutosave();

    if (odysseyClient) {
        try {
            odysseyClient.disconnect();
        } catch (_) {
            // no-op
        }
    }

    streamCards.forEach((cardState) => {
        try {
            cardState.client?.disconnect();
        } catch (_) {
            // no-op
        }
    });
}

function cleanupForPageExit(reason = 'page-exit') {
    cancelScheduledProjectAutosave();
    if (activeProjectId) {
        void captureProjectRuntimeSnapshot(activeProjectId, { freezeStreams: false });
    }
    disconnectAllOdysseyClientsSync(reason);
}

window.addEventListener('beforeunload', () => {
    cleanupForPageExit('beforeunload');
});

window.addEventListener('pagehide', () => {
    cleanupForPageExit('pagehide');
});

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && activeProjectId) {
        void autosaveActiveProjectNow({ freezeStreams: false });
    }
});

window.addEventListener('beforeunload', () => {
    if (dynamicBgRefreshTimeoutId) {
        clearTimeout(dynamicBgRefreshTimeoutId);
        dynamicBgRefreshTimeoutId = null;
    }
    if (dynamicBgSwapTimeoutId) {
        clearTimeout(dynamicBgSwapTimeoutId);
        dynamicBgSwapTimeoutId = null;
    }
    if (dynamicBgRefreshIntervalId) {
        clearInterval(dynamicBgRefreshIntervalId);
        dynamicBgRefreshIntervalId = null;
    }
});

console.log('🎬 Voice Evolution Video loaded');
console.log('📝 App starts directly in workspace');
console.log('🎵 Voice Controls:');
console.log('   🎬 Say "CUT" to freeze');
console.log('   🎬 Say "ACTION" to continue');
console.log('   💥 Sudden loud = shock effect');
console.log('   😱 Sustained loud = increasing horror');
console.log('   🤫 Sudden quiet = eerie silence');
console.log('   🖐️ Use hand gestures for actions');
console.log('   ☝️ Point finger = cursor on video');
console.log('   🤏 Pinch or Grab = drag stream cards');
console.log('   🎯 Click + type prompt = grounded scene edit');
