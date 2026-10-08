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

export function t(lang: Lang, key: StringKey): string {
  return strings[key][lang]
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
