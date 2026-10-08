// Every UI string lives here, with `en` and `hi`. Hindi needs a native speaker's review.

export type Lang = 'en' | 'hi'

const strings = {
  appTitle: { en: 'Clean Period', hi: 'क्लीन पीरियड' },
  tagline: {
    en: "Move tomorrow's outdoor periods to the cleanest hours. No period is cancelled.",
    hi: 'कल के बाहर वाले पीरियड सबसे साफ़ हवा वाले घंटों में रखें। कोई पीरियड रद्द नहीं होता।',
  },
  langToggle: { en: 'हिंदी', hi: 'English' },

  school: { en: 'School', hi: 'स्कूल' },
  schoolName: { en: 'School name', hi: 'स्कूल का नाम' },
  searchPlace: { en: 'Town or city', hi: 'शहर या कस्बा' },
  find: { en: 'Find', hi: 'खोजें' },
  searching: { en: 'Searching…', hi: 'खोज रहे हैं…' },
  noPlaces: { en: 'No place found. Try the nearest city.', hi: 'कोई जगह नहीं मिली। पास का शहर लिखें।' },
  useMyLocation: { en: 'Use my location', hi: 'मेरी लोकेशन लें' },
  locating: { en: 'Finding you…', hi: 'लोकेशन ले रहे हैं…' },
  locationError: { en: 'Could not get the location', hi: 'लोकेशन नहीं मिल सकी' },
  locationNow: { en: 'Location', hi: 'लोकेशन' },
  noLocation: { en: 'not set', hi: 'तय नहीं' },
  cityEnough: {
    en: 'The nearest town or city is enough: the air forecast covers about 45 km.',
    hi: 'पास का शहर काफ़ी है: हवा का पूर्वानुमान लगभग 45 km के क्षेत्र का होता है।',
  },
  placeSource: { en: 'Place search: Open-Meteo Geocoding API (GeoNames).', hi: 'जगह खोज: Open-Meteo Geocoding API (GeoNames)।' },
  slots: { en: 'Periods of the school day', hi: 'स्कूल के दिन के पीरियड' },
  slotsHelp: {
    en: 'Same times for every class. Removing a time removes it from every class.',
    hi: 'हर कक्षा के लिए एक ही समय। समय हटाने पर वह हर कक्षा से हट जाएगा।',
  },
  start: { en: 'Start', hi: 'शुरू' },
  end: { en: 'End', hi: 'खत्म' },
  addSlot: { en: '+ Add time', hi: '+ समय जोड़ें' },
  remove: { en: 'Remove', hi: 'हटाएँ' },
  classes: { en: 'Classes', hi: 'कक्षाएँ' },
  className: { en: 'Class name', hi: 'कक्षा का नाम' },
  addClass: { en: '+ Add class', hi: '+ कक्षा जोड़ें' },
  removeClass: { en: 'Remove class', hi: 'कक्षा हटाएँ' },
  addPeriod: { en: '+ Add period', hi: '+ पीरियड जोड़ें' },
  emptySlot: { en: 'No period', hi: 'कोई पीरियड नहीं' },
  resetSample: { en: 'Load sample timetable', hi: 'नमूना समय-सारणी लें' },
  startEmpty: { en: 'Start empty', hi: 'खाली से शुरू करें' },
  confirmReplace: {
    en: 'This replaces the timetable on this device. Continue?',
    hi: 'इससे इस डिवाइस पर सहेजी समय-सारणी बदल जाएगी। जारी रखें?',
  },
  savedLocally: { en: 'Saved on this device only.', hi: 'केवल इसी डिवाइस पर सहेजा गया।' },
  usingDay: {
    en: 'Tomorrow is {tomorrow}. Planning with the {day} timetable.',
    hi: 'कल {tomorrow} है। {day} की समय-सारणी से योजना बन रही है।',
  },
  fixFirst: { en: 'Fix these first:', hi: 'पहले इन्हें ठीक करें:' },
  needLocation: { en: 'Set the school location', hi: 'स्कूल की लोकेशन तय करें' },
  needClass: { en: 'Add at least one class', hi: 'कम से कम एक कक्षा जोड़ें' },
  needClassName: { en: 'Every class needs a name', hi: 'हर कक्षा का नाम चाहिए' },
  needSubject: { en: 'Period without a subject', hi: 'बिना विषय का पीरियड' },
  slotEndsBeforeStart: { en: 'A period ends before it starts', hi: 'एक पीरियड शुरू होने से पहले खत्म होता है' },
  slotsOverlap: { en: 'Two period times overlap', hi: 'दो पीरियड के समय टकराते हैं' },
  latitude: { en: 'Latitude', hi: 'अक्षांश' },
  longitude: { en: 'Longitude', hi: 'देशांतर' },
  timetable: { en: 'Timetable', hi: 'समय-सारणी' },
  sampleNote: {
    en: "Sample timetable for testing, not a real school's timetable.",
    hi: 'जाँच के लिए नमूना समय-सारणी, किसी असली स्कूल की नहीं।',
  },
  dayLabel: { en: "Use this day's timetable", hi: 'इस दिन की समय-सारणी लें' },
  subject: { en: 'Subject', hi: 'विषय' },
  activity: { en: 'Activity', hi: 'गतिविधि' },
  teacher: { en: 'Teacher', hi: 'शिक्षक' },
  movable: { en: 'Can move', hi: 'बदल सकते हैं' },
  fixed: { en: 'Fixed', hi: 'तय' },
  outdoor: { en: 'Outdoors', hi: 'बाहर' },
  indoor: { en: 'Indoors', hi: 'अंदर' },

  makePlan: { en: "Make tomorrow's plan", hi: 'कल की योजना बनाएँ' },
  planning: { en: 'Planning…', hi: 'योजना बन रही है…' },
  planError: { en: 'Could not make the plan', hi: 'योजना नहीं बन सकी' },

  planFor: { en: 'Plan for', hi: 'योजना:' },
  verdictReorder: {
    en: 'Outdoor periods moved to cleaner hours',
    hi: 'बाहर के पीरियड साफ़ हवा वाले घंटों में रखे गए',
  },
  verdictIndoors: {
    en: 'All indoors: every school hour is Very Poor or worse',
    hi: 'सब अंदर: स्कूल का हर घंटा "बहुत खराब" या उससे बुरा है',
  },
  doseCut: { en: 'estimated dose cut', hi: 'खुराक में अनुमानित कमी' },
  before: { en: 'Before', hi: 'पहले' },
  after: { en: 'After', hi: 'बाद में' },
  moved: { en: 'moved', hi: 'बदला' },
  madeIndoor: { en: 'now indoors', hi: 'अब अंदर' },
  noMoves: { en: 'No change needed', hi: 'कोई बदलाव ज़रूरी नहीं' },
  airTomorrow: { en: 'Air during school hours (PM2.5, µg/m³)', hi: 'स्कूल के समय की हवा (PM2.5, µg/m³)' },
  dose: { en: 'Inhaled PM2.5', hi: 'साँस में गया PM2.5' },

  noticeTitle: { en: 'Notice for parents', hi: 'अभिभावकों के लिए सूचना' },
  makeNotice: { en: 'Write parent notice', hi: 'अभिभावक सूचना लिखें' },
  writing: { en: 'Writing…', hi: 'लिखी जा रही है…' },
  noticeError: { en: 'Could not write the notice', hi: 'सूचना नहीं लिखी जा सकी' },
  copy: { en: 'Copy', hi: 'कॉपी करें' },
  copied: { en: 'Copied', hi: 'कॉपी हो गया' },
  noticeByAi: {
    en: 'Wording by AI (Claude on Amazon Bedrock), checked by code: every number comes from the plan.',
    hi: 'शब्द AI (Amazon Bedrock पर Claude) ने लिखे, कोड ने जाँचे: हर संख्या योजना से है।',
  },
  noticeByTemplate: { en: 'Written by code from the plan.', hi: 'योजना से कोड द्वारा लिखी गई।' },
  english: { en: 'English', hi: 'अंग्रेज़ी' },
  hindi: { en: 'Hindi', hi: 'हिंदी' },

  nightlyTitle: { en: 'Nightly plan', hi: 'हर शाम की योजना' },
  nightlyHelp: {
    en: "Save this school and Clean Period plans the next day every evening at 19:00 IST, with the parent notice ready.",
    hi: 'स्कूल सहेजें, फिर हर शाम 19:00 बजे (IST) अगले दिन की योजना और अभिभावक सूचना अपने आप तैयार होगी।',
  },
  saveSchool: { en: 'Save school for nightly plans', hi: 'हर शाम की योजना के लिए स्कूल सहेजें' },
  saving: { en: 'Saving…', hi: 'सहेज रहे हैं…' },
  savedAs: { en: 'Saved. School ID', hi: 'सहेजा गया। स्कूल ID' },
  keyWarning: {
    en: 'The edit key is kept only in this browser. Without it the saved timetable cannot be changed.',
    hi: 'बदलाव की कुंजी केवल इसी ब्राउज़र में है। इसके बिना सहेजी गई समय-सारणी बदली नहीं जा सकती।',
  },
  updateSaved: { en: 'Update saved timetable', hi: 'सहेजी समय-सारणी अपडेट करें' },
  updated: { en: 'Saved timetable updated.', hi: 'सहेजी समय-सारणी अपडेट हो गई।' },
  showNightly: { en: 'Show latest nightly plan', hi: 'पिछली शाम की योजना दिखाएँ' },
  loadingNightly: { en: 'Loading…', hi: 'लोड हो रहा है…' },
  nightlyMadeAt: { en: 'Made at', hi: 'बनी' },
  nightlyNoSchool: { en: 'No school that day', hi: 'उस दिन स्कूल नहीं' },
  nightlyFailed: { en: 'The nightly plan failed', hi: 'शाम की योजना नहीं बन सकी' },
  saveError: { en: 'Could not save', hi: 'सहेजा नहीं जा सका' },
  loadError: { en: 'Could not load the nightly plan', hi: 'शाम की योजना लोड नहीं हो सकी' },
  nightlyNone: {
    en: 'No nightly plan yet. Plans are made every evening at 19:00 IST.',
    hi: 'अभी कोई योजना नहीं बनी। योजना हर शाम 19:00 बजे (IST) बनती है।',
  },

  backtestTitle: { en: 'Last winter, replayed', hi: 'पिछली सर्दी, दोबारा जाँची' },
  backtestSub: { en: 'Sample timetable, real air data', hi: 'नमूना समय-सारणी, असली हवा का डेटा' },
  seasonCut: { en: 'season dose cut', hi: 'पूरे मौसम में खुराक में कमी' },
  meanDaily: { en: 'average of daily cuts', hi: 'रोज़ की कमी का औसत' },
  schoolDays: { en: 'school days', hi: 'स्कूल के दिन' },
  allIndoorsDays: { en: 'all-indoors days', hi: 'सब-अंदर वाले दिन' },
  byWeekday: { en: 'Average cut by weekday', hi: 'दिन के हिसाब से औसत कमी' },
  hourlyProfile: { en: 'Typical PM2.5 by hour (median)', hi: 'घंटे के हिसाब से आम PM2.5 (माध्यिका)' },

  sources: { en: 'Sources and assumptions', hi: 'स्रोत और मान्यताएँ' },
  estimates: { en: 'All numbers are estimates.', hi: 'सभी आँकड़े अनुमान हैं।' },
  limitsNote: {
    en: 'This reduces exposure. It does not make a severe day safe.',
    hi: 'इससे प्रदूषण का असर कम होता है, पर बहुत खराब दिन सुरक्षित नहीं बनता।',
  },
} as const satisfies Record<string, Record<Lang, string>>

export type StringKey = keyof typeof strings

export function t(lang: Lang, key: StringKey, vars: Record<string, string> = {}): string {
  return strings[key][lang].replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? `{${k}}`)
}

export const activityNames: Record<string, Record<Lang, string>> = {
  classroom: { en: 'Classroom', hi: 'कक्षा में' },
  assembly: { en: 'Assembly', hi: 'प्रार्थना सभा' },
  recess: { en: 'Recess', hi: 'मध्यावकाश' },
  pe: { en: 'PE / sports', hi: 'खेल-कूद' },
  indoor_activity: { en: 'Indoor activity', hi: 'अंदर की गतिविधि' },
}

export const weekdayNames: Record<string, Record<Lang, string>> = {
  monday: { en: 'Monday', hi: 'सोमवार' },
  tuesday: { en: 'Tuesday', hi: 'मंगलवार' },
  wednesday: { en: 'Wednesday', hi: 'बुधवार' },
  thursday: { en: 'Thursday', hi: 'गुरुवार' },
  friday: { en: 'Friday', hi: 'शुक्रवार' },
  saturday: { en: 'Saturday', hi: 'शनिवार' },
  sunday: { en: 'Sunday', hi: 'रविवार' },
}

export const categoryNames: Record<string, Record<Lang, string>> = {
  Good: { en: 'Good', hi: 'अच्छा' },
  Satisfactory: { en: 'Satisfactory', hi: 'संतोषजनक' },
  Moderate: { en: 'Moderate', hi: 'मध्यम' },
  Poor: { en: 'Poor', hi: 'खराब' },
  'Very Poor': { en: 'Very Poor', hi: 'बहुत खराब' },
  Severe: { en: 'Severe', hi: 'गंभीर' },
}
