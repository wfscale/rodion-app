import type { Dict } from './ru';

export const en: Dict = {
  nav: {
    home: 'Home',
    outreach: 'Outreach',
    progress: 'Progress',
    notes: 'Notes',
    settings: 'Settings',
    project: 'Project',
  },

  common: {
    save: 'Save',
    saving: 'Saving…',
    saved: 'Saved',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    add: 'Add',
    close: 'Close',
    search: 'Search',
    loading: 'Loading…',
    today: 'Today',
    copy: 'Copy text',
    copied: 'Copied',
    all: 'All',
    none: '—',
    optional: 'optional',
    required: 'required',
    confirmDelete: 'Delete for good? This cannot be undone.',
    xp: 'XP',
    day: 'day',
    days2: 'days',
    days5: 'days',
    retry: 'Retry',
    error: 'Something went wrong',
    open: 'Open',
    done: 'Done',
    locked: 'Unlocks at level',
  },

  auth: {
    title: 'Your Growth',
    subtitle: 'Outreach is what moves. Everything else is background.',
    signIn: 'Sign in',
    signUp: 'Sign up',
    email: 'Email',
    password: 'Password',
    confirmPassword: 'Repeat password',
    submitSignIn: 'Sign in',
    submitSignUp: 'Create account',
    passwordMismatch: 'Passwords do not match',
    passwordShort: 'At least 6 characters',
    emailInvalid: 'Invalid email',
    processing: 'One moment…',
    invalidCredentials: 'Wrong email or password',
    userExists: 'This user already exists — just sign in',
  },

  levels: [
    'Rookie',
    'Hunter',
    'Sniper',
    'Negotiator',
    'Producer',
    'Strategist',
    'Architect',
    'Master',
    'Legend',
  ],

  home: {
    greeting: 'Welcome back',
    today: 'TODAY',
    ofQuota: 'of {n} (quota)',
    quotaClosed: 'Quota closed. Every next one is a bonus. Keep going?',
    quotaCurrent: 'Quota',
    quotaGrows: 'Grows in {n} more → becomes {q}',
    quotaMax: 'Quota is maxed out',
    record: 'Record',
    chain: 'Chain',
    cycle: 'Cycle from {date} · Day {n}',

    addOutreach: '+ OUTREACH',
    namePh: 'Name / handle',
    nichePh: 'Niche',
    addDone: 'Done',

    feedTitle: 'Today',
    feedEmpty: 'Quiet so far. The first message starts the day.',

    tasksTitle: 'TASKS FOR TODAY',
    taskPh: 'What needs doing today?',
    addTask: '+ add task',

    habitsTitle: 'The basics are hygiene, not results.',

    checkinTitle: 'Morning check-in',
    checkinDone: 'Check-in done',
    sleepTime: 'Went to bed',
    wakeTime: 'Woke up',
    wakeQuality: 'How was waking up',
    wakeEasy: 'Easy',
    wakeNormal: 'Normal',
    wakeHard: 'Hard',
    checkinComment: 'Comment',
    checkinCommentPh: 'How you feel, what is on your mind…',
    saveCheckin: 'Save check-in',

    nutritionTitle: 'Nutrition',
    meal1: 'First meal (12:00+)',
    meal2: 'Second meal (before 20:00)',
    mealNotePh: 'What you ate',
    fasting: 'Kept the 12:00–20:00 fast',

    notesTitle: 'What matters today?',
    notesPh: 'A thought, a takeaway, something to remember…',
    autosaved: 'Autosaved',

    soberMode: 'Sober mode',
  },

  habits: {
    water: 'Water 500 ml + pinch of salt',
    pushups: '50 push-ups',
    coldShower: 'Cold shower (60 sec)',
    walk: 'Walk outside',
    d3: 'Took D3',
    noReels: 'No mindless reels',
  },

  outreach: {
    title: 'Outreach',
    tabContacts: 'Contacts',
    tabOffers: 'Offers',

    quickName: 'Name / handle',
    quickNiche: 'Niche',
    newOutreach: 'New outreach',

    funnelSent: 'sent',
    funnelReplied: 'replied',
    funnelCall: 'calls',
    funnelClosed: 'closed',

    hintNoReplies: 'Keep writing. The first reply will come.',
    hintNextReply: 'To the next reply: ≈ {n} messages',
    hintAboveAverage: 'Your conversion is above average. Keep going.',

    filterIgnored: 'Ignored/Refused',

    viewCards: 'Cards',
    viewTable: 'Table',
    fullscreen: 'Expand',
    exitFullscreen: 'Collapse',

    colNum: '#',
    colStatus: 'Status',
    colName: 'Name',
    colTelegram: 'Telegram',
    colInstagram: 'IG link',
    colNiche: 'Niche',
    colDate: 'First touch',
    colDays: 'Days since',
    colComment: 'Offer / Comment',
    colNextStep: 'Next step',
    colSpeed: 'Reply speed',

    openLink: 'Open →',
    daysAgo: '{n} ago',
    today: 'today',

    addTitle: 'New outreach',
    fieldName: 'Expert name',
    fieldTelegram: 'Telegram',
    fieldInstagram: 'Instagram handle',
    fieldNiche: 'Niche',
    fieldComment: 'Offer / Comment',
    fieldStatus: 'Status',
    fieldDate: 'First touch date',
    fieldNextStep: 'Next step',
    igHint: 'link: instagram.com/{handle}',
    submit: 'Save →',

    detailTitle: 'Expert card',
    history: 'Status history',
    noHistory: 'No changes yet.',
    saveToOffers: 'Save to offers',
    savedToOffers: 'Added to offers',

    inlineAdd: 'Add right here',
    empty: 'Empty so far. The first one goes on top.',
    emptyFiltered: 'Nobody in this status.',
    searchPh: 'Find by name…',

    toastAdded: 'Outreach added',
    toastRound: '🎯 {n} today. Do not stop.',
    toastRecord: '⚡ Record! {n} messages — your new maximum.',
  },

  followup: {
    title: 'Who to message today',
    empty: 'Nobody needs a nudge today.',
    touch: 'Touched',
    mute: 'Stop reminding',
    unmute: 'Resume',
    overdue: 'overdue by {n}',
    due: 'today',
    soon: 'tomorrow',
    cold: 'cold',
    silentDays: 'silent for {n}',
    touchNumber: 'touch {n}',
    hint: 'Intervals grow: 1 → 3 → 7 → 15 → 30 days. After that the lead is considered cold.',
  },

  statuses: {
    not_sent: 'Not sent',
    sent: 'Sent',
    read: 'Read',
    replied: 'Replied',
    replied_no: 'Replied — no',
    refused: 'Refused',
    blocked: 'Blocked',
    call: 'Call',
    closed: 'Closed',
  },

  offers: {
    title: 'Offers',
    empty: 'Library is empty. Save messages here — you will see what works.',
    addTitle: 'New offer',
    offerTitle: 'Title',
    offerTitlePh: 'Offer for a fitness expert',
    content: 'Offer text',
    contentPh: 'Personal observation → problem → proposal…',
    result: 'Result',
    resultAuto: 'mirrors the outreach status',
    note: 'What worked / what did not',
    notePh: 'Debrief: why they replied or why they did not…',
    linkContact: 'Link to contact',
    noContact: 'No link',
    submit: 'Save offer',
    detailTitle: 'Offer',
    analytics: 'Analytics by niche',
    analyticsEmpty: 'Add outreach — the niche breakdown will show up here.',
    colNiche: 'Niche',
    colSent: 'Sent',
    colReplied: 'Replied',
    colRate: '% conversion',
  },


  tags: {
    idea: 'Idea',
    goal: 'Goal',
    insight: 'Insight',
    thought: 'Thought',
  },

  activity: {
    sent: 'Sent',
    replied: 'replied',
    call: 'call',
    closed: 'closed',
    quota: 'quota closed',
    record: 'daily record',
  },

  progress: {
    title: 'Progress',
    streakTitle: 'day streak',
    streakHint: 'Outreach every day — the chain holds.',
    streakZero: 'Start today.',
    longest: 'Record',

    levelTitle: 'Level',
    toNext: 'To next level',
    totalXp: 'Total XP',
    nextTeaser: 'Next: {name}',
    unknownAhead: 'Beyond this — unknown. Get there.',

    weekTitle: 'Week',
    xpChart: 'XP over 7 days',
    xpChartEmpty: 'No data yet — go earn your first XP.',

    funnelTitle: 'All-time funnel',
    quotaTitle: 'Quota',
    modeTitle: 'Mode',
    unlocksTitle: 'Unlocked',
  },

  features: {
    offers: 'Offer library',
    offersDesc: 'Save your outreach texts and see which ones work.',
    offersUnlock: 'A hunter builds an arsenal. Now you know what works and what does not.',

    niches: 'Niche analytics',
    nichesDesc: 'Where the response is alive: niche, sent, replied, conversion.',
    nichesUnlock: 'A sniper does not shoot into the void. Now you see where the targets are alive.',

    speed: 'Speed counter',
    speedDesc: 'How long from message to reply. Plus a “next step” on each card.',
    speedUnlock: 'Replies are coming. Now the moment matters.',

    project: 'Project section',
    projectDesc: 'Run an expert launch: stages, deadline, deal size.',
    projectUnlock: 'You closed an expert. You are a producer. Welcome.',

    report: 'Weekly report',
    reportDesc: 'Every Monday — a summary of the week before.',
    reportUnlock: 'A strategist runs the system instead of just working inside it.',

    scale: 'Scale dashboard',
    scaleDesc: 'Revenue forecast for 30 / 60 / 90 days at your current conversion.',
    scaleUnlock: 'You see the whole system. Build.',
  },

  firstEvents: {
    replyTitle: 'FIRST REPLY',
    replyBody: 'It works.\nThe messages were silent.\nThis one answered.\nKeep going.',
    callTitle: 'FIRST CALL',
    callBody: 'They want to talk to you.\nThis is no longer outreach.\nThis is negotiation.',
    closedTitle: 'FIRST CLOSE',
    closedBody:
      'Someone paid you for your mind.\nRemember this feeling.\nThis is exactly what all those messages were for.',
  },

  quotaOverlay: {
    title: 'QUOTA CLOSED',
    question: 'Keep going?',
    continue: 'Keep going',
    stop: 'Done for today',
  },

  sober: {
    open: 'Sober mode',
    next: 'Next',
    s1Title: 'Stop.',
    s1: `Right now you want to jerk off, eat something sweet or sink into reels.

That is not your desire. That is your brain in panic — it did not get dopamine and it is screaming for you to hand it over right now.

If you give in, it goes quiet for 20 minutes. Then it screams louder. And demands more.

And here is what matters most: after that you will not be able to do outreach. You will be back in that state where even starting is hard. Where you stare at the screen and cannot write the first word. Literally cannot — you simply will not have the chemistry for it.`,

    s2Title: 'Understand how this works.',
    s2: `Noradrenaline is the fuel for your actions. It is what gives you the strength to sit down and do what you do not feel like doing.

It is synthesized from dopamine.

When you spend dopamine on porn, sugar and reels, there is nothing left for noradrenaline. Literally nothing. And that is why an hour later you sit there unable to make yourself write even one message.

Outreach demands noradrenaline. Outreach is exactly the kind of action under pressure that produces it.

There is one way out: do not waste dopamine. Save it for outreach. Every message is a dose. Every reply is a high you earned.`,

    s3Title: 'You have {n} days.',
    s3: `If you are not earning by that date — the army. A year lost. Precisely the year when you can build everything and reach everything, while the body is young, while the head is clear, while the doors are open.

18–19 is the perfect age. Not later. Now.

Outreach → closing an expert → money → freedom → moving → travel → the life you want.

Just one message right now.
Not ten. One.
And everything shifts.`,

    s3Extra: `One more thing.

While you hold — your face gets leaner. The puffiness goes. The skin tightens over your cheekbones. Your voice drops. You start to look different — not because you lost weight, but because your hormones are changing. Testosterone rises. Women read it — not with their minds, with instinct. You become a different rank of person. Literally.

Sugar and porn are the price of staying unnoticed.
Abstinence is the price of becoming a magnet.`,

    cta: 'OPEN OUTREACH',
    deadlinePassed: 'The date has passed. Set a new one in settings.',
  },

  mode: {
    title: 'Mode',
    active: 'MODE ACTIVE',
    porn: 'No porn',
    mb: 'No masturbation',
    sugar: 'No sugar',
    checkinTitle: 'Did you hold today?',
    yes: 'Yes',
    no: 'No',
    reset: 'Tomorrow it starts again.',
    doneToday: 'Evening check-in done.',
    stages: {
      s0: 'Start today.',
      s1: 'The first 72 hours are the hardest.',
      s2: 'A week. The brain starts rewiring.',
      s3: 'Noradrenaline is rising. You notice the difference.',
      s4: 'Cheekbones showing. Voice deeper. You are in another state.',
      s5: 'You switched. This is not temporary — this is the new mode.',
    },
  },

  project: {
    title: 'Project',
    empty: 'No active project. Close an expert and start one here.',
    add: 'New project',
    expertName: 'Expert name',
    niche: 'Niche',
    status: 'Launch status',
    statusPrep: 'Preparation',
    statusLaunch: 'Launch',
    statusDone: 'Finished',
    stages: 'Stages',
    stagePh: 'New stage',
    launchDate: 'Launch deadline',
    dealAmount: 'Deal amount',
    note: 'Notes',
  },

  report: {
    title: 'Weekly report',
    empty: 'The first report appears on Monday.',
    week: 'Week',
    sent: 'sent',
    replied: 'replies',
    calls: 'calls',
    closed: 'closes',
    xp: 'XP',
    bestDay: 'Best day',
  },

  scale: {
    title: 'Scale dashboard',
    avgDeal: 'Average deal',
    avgDealHint: 'Enter manually — the forecast is built from it.',
    pace: 'Current pace',
    perDay: 'messages per day',
    forecast: 'At this pace',
    in30: '30 days',
    in60: '60 days',
    in90: '90 days',
    closings: 'closes',
    money: 'revenue',
    needData: 'Need more data: send at least a few messages.',
  },

  notes: {
    title: 'Notes',
    placeholder: 'What is on your mind? Idea, goal, insight…',
    save: 'Save',
    searchPh: 'Search text…',
    empty: 'No notes yet.',
    emptySearch: 'Nothing found.',
    edited: 'edited',
    trash: 'Trash',
    trashEmpty: 'Trash is empty.',
    trashHint: 'Deleted notes are kept for 30 days.',
    restore: 'Restore',
    deleteForever: 'Delete forever',
    daysLeft: 'days left',
  },

  settings: {
    title: 'Settings',

    profile: 'Profile',
    username: 'Name',
    usernamePh: 'What to call you',
    email: 'Email',
    signOut: 'Sign out',

    goals: 'Stakes',
    deadline: 'Deadline',
    deadlineHint: 'The sober-mode counter is measured from this date.',
    quotaInfo: 'Daily quota',
    quotaInfoHint: 'It grows on its own: +3 every 3 closed days. Not set by hand.',

    feedback: 'Feedback',
    sounds: 'Gamification sounds',
    soundsHint: 'Short synthetic cues on adding and closing.',
    vibration: 'Vibration',
    vibrationHint: 'Works on phones; Safari disables it at the system level.',

    push: 'Notifications',
    pushEnable: 'Enable notifications',
    pushDisable: 'Disable notifications',
    pushHint: 'Four a day: 09:30, 14:00, 20:00 and the evening check-in at 23:00.',
    pushDenied: 'Notifications are blocked in browser settings — allow them manually.',
    pushUnsupported: 'This device does not support push. On iPhone, add the app to the Home Screen.',
    pushOn: 'Notifications are on',

    integrations: 'Integrations',
    googleSheets: 'Google Sheets',
    googleConnect: 'Connect Google Sheets',
    googleDisconnect: 'Disconnect',
    googleConnected: 'Connected',
    sheetId: 'Spreadsheet ID',
    sheetIdHint: 'From the link: docs.google.com/spreadsheets/d/SHEET_ID/edit',
    syncNow: 'Sync now',
    syncing: 'Syncing…',
    lastSync: 'Last sync',
    neverSynced: 'never synced yet',
    googleNotConfigured:
      'Integration is not configured on the server — it needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.',

    language: 'Language',
    languageRu: 'Русский',
    languageEn: 'English',

    data: 'Data',
    exportJson: 'Export all data (JSON)',
    exporting: 'Preparing file…',
    clearOutreach: 'Clear outreach history',
    clearOutreachConfirm:
      'Delete every outreach contact? Offers and their links stay. Cannot be undone.',
    cleared: 'Outreach history cleared',

    about: 'About',
    version: 'Version',
    aboutText: 'Built for Rodion. Outreach is what moves — the rest is background.',
  },

  xpReasons: {
    outreach: 'Outreach',
    replied: 'Expert replied',
    call: 'Call booked',
    closed: 'Expert closed',
    quota: 'Quota closed',
    record: 'Daily record',
    bonus: 'Bonus over quota',
    habit: 'Habit',
    checkin: 'Morning check-in',
    mode: 'Mode kept',
  },

  levelUp: {
    title: 'LEVEL UP',
    unlocked: 'Unlocked',
    continue: 'Continue',
  },
};
