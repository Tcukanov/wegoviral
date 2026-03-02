export interface CategoryBenchmark {
  likeRate: number;
  commentRate: number;
  idealDuration: number;
  idealHashtags: number;
}

const BENCHMARKS: Record<string, CategoryBenchmark> = {
  fitness:    { likeRate: 3.2, commentRate: 0.8,  idealDuration: 15, idealHashtags: 5 },
  finance:    { likeRate: 2.1, commentRate: 1.2,  idealDuration: 30, idealHashtags: 6 },
  food:       { likeRate: 4.1, commentRate: 0.6,  idealDuration: 20, idealHashtags: 7 },
  beauty:     { likeRate: 3.8, commentRate: 0.9,  idealDuration: 30, idealHashtags: 6 },
  motivation: { likeRate: 5.2, commentRate: 1.4,  idealDuration: 15, idealHashtags: 5 },
  comedy:     { likeRate: 6.1, commentRate: 2.1,  idealDuration: 10, idealHashtags: 4 },
  lifestyle:  { likeRate: 3.5, commentRate: 0.9,  idealDuration: 20, idealHashtags: 6 },
  travel:     { likeRate: 4.0, commentRate: 0.7,  idealDuration: 25, idealHashtags: 7 },
  fashion:    { likeRate: 4.2, commentRate: 0.8,  idealDuration: 15, idealHashtags: 8 },
  tech:       { likeRate: 2.8, commentRate: 1.1,  idealDuration: 30, idealHashtags: 5 },
  pets:       { likeRate: 5.5, commentRate: 1.5,  idealDuration: 15, idealHashtags: 5 },
  sports:     { likeRate: 3.6, commentRate: 0.9,  idealDuration: 20, idealHashtags: 5 },
  music:      { likeRate: 4.8, commentRate: 1.2,  idealDuration: 15, idealHashtags: 6 },
  gaming:     { likeRate: 3.3, commentRate: 1.8,  idealDuration: 20, idealHashtags: 5 },
  education:  { likeRate: 2.9, commentRate: 1.0,  idealDuration: 30, idealHashtags: 5 },
  other:      { likeRate: 3.0, commentRate: 0.8,  idealDuration: 20, idealHashtags: 6 },
};

export function getBenchmarks(category: string): CategoryBenchmark {
  return BENCHMARKS[category.toLowerCase()] ?? BENCHMARKS.other;
}

const HASHTAG_CATEGORIES: Record<string, string[]> = {
  fitness: [
    "fitness", "workout", "gym", "exercise", "bodybuilding", "lifting", "cardio",
    "training", "gains", "muscle", "crossfit", "running", "yoga", "weightloss",
    "physique", "athlete", "hiit", "gymtok", "squat", "deadlift", "bench",
    "bulking", "cutting", "shredded", "calisthenics", "pilates", "stretching",
  ],
  finance: [
    "finance", "money", "investing", "sidehustle", "personalfinance", "wealth",
    "stocks", "crypto", "budget", "saving", "income", "entrepreneur", "business",
    "trading", "passive", "richlife", "debt", "moneytok", "frugal", "realestate",
    "dividends", "financial", "retirement", "marketing", "startup",
    "бизнес", "маркетинг", "финансы", "деньги", "инвестиции", "предприниматель",
    "стартап", "доход", "заработок", "предпринимательство",
    "negocio", "dinero", "finanzas", "marketing",
  ],
  food: [
    "food", "recipe", "cooking", "foodie", "easyrecipe", "foodtok", "baking",
    "burger", "pizza", "pasta", "sandwich", "kitchen", "dinner", "lunch",
    "breakfast", "chef", "delicious", "tasty", "yummy", "homemade", "grill",
    "bbq", "snack", "dessert", "cake", "restaurant", "foodporn", "eating",
    "mukbang", "cookwithme", "meal", "mealprep", "vegan", "glutenfree",
  ],
  beauty: [
    "beauty", "makeup", "skincare", "grwm", "makeuptutorial", "glam", "cosmetics",
    "foundation", "lipstick", "eyeshadow", "nails", "hairstyle", "blush",
    "contour", "skincareroutine", "selfcare", "beautytok", "ootd", "glowup",
    "haircare", "eyeliner", "concealer", "moisturizer",
  ],
  motivation: [
    "motivation", "mindset", "productivity", "success", "selfimprovement", "goals",
    "inspire", "grind", "hustle", "discipline", "mentalhealth", "positivity",
    "mindfulness", "growth", "affirmations", "journal", "morningroutine",
  ],
  comedy: [
    "funny", "comedy", "relatable", "humor", "memes", "prank", "skit",
    "laugh", "joke", "hilarious", "lmao", "lol", "comicreels", "parody",
  ],
  lifestyle: [
    "lifestyle", "dayinmylife", "vlog", "roomtour", "officetour", "worklife",
    "wfh", "workfromhome", "office", "adulting", "routines", "morningroutine",
    "nightroutine", "productivity", "minimal", "aesthetic", "slowliving",
    "corporatelife", "corporate",
  ],
  travel: [
    "travel", "traveltok", "wanderlust", "vacation", "explore", "adventure",
    "roadtrip", "travelvlog", "traveling", "destination", "hotel", "flight",
    "backpacking", "solo", "travelgram", "worldtravel", "travellife",
  ],
  fashion: [
    "fashion", "ootd", "style", "outfitinspo", "clothes", "outfit", "streetstyle",
    "streetwear", "thrift", "thrifting", "vintage", "fashiontok", "lookbook",
    "haul", "shein", "zara", "styling",
  ],
  tech: [
    "tech", "technology", "gadgets", "iphone", "android", "apple", "software",
    "coding", "programming", "developer", "ai", "startup", "saas", "techtok",
    "cybersecurity", "unboxing", "review", "app",
  ],
  pets: [
    "pets", "dog", "cat", "puppy", "kitten", "dogsofinstagram", "catsofinstagram",
    "petlover", "animals", "cute", "wildlife", "doggo", "furrybaby",
  ],
  sports: [
    "sports", "football", "basketball", "soccer", "nba", "nfl", "tennis",
    "baseball", "cricket", "swimming", "cycling", "golf", "hockey",
    "highlights", "athlete", "game",
  ],
  music: [
    "music", "singing", "musician", "song", "cover", "rapper", "hiphop",
    "rnb", "pop", "guitar", "piano", "producer", "beat", "newmusic",
    "musicvideo", "lyrics",
  ],
  gaming: [
    "gaming", "gamer", "videogames", "twitch", "xbox", "playstation", "ps5",
    "nintendo", "fps", "minecraft", "fortnite", "valorant", "gameplay",
    "streamer", "gamingsetup",
  ],
  education: [
    "education", "learning", "study", "school", "college", "university",
    "didyouknow", "facts", "science", "history", "howto", "explainer",
    "teaching", "knowledge", "tips", "tutorial", "learnontiktok",
  ],
};

// Pre-compiled word-boundary regex per keyword for accurate matching
// Uses Unicode-aware boundaries for non-Latin scripts (Cyrillic, etc.)
const CATEGORY_PATTERNS: Map<string, { regex: RegExp }[]> = new Map();

for (const [category, keywords] of Object.entries(HASHTAG_CATEGORIES)) {
  const patterns = keywords.map((kw) => {
    const isLatin = /^[a-z0-9]+$/i.test(kw);
    const regex = isLatin
      ? new RegExp(`(?:^|[\\s#@/.,!?;:'"()])${kw}(?=$|[\\s#@/.,!?;:'"()])`, "i")
      : new RegExp(`(?:^|[\\s#@/.,!?;:'"()\\p{P}])${kw}(?=$|[\\s#@/.,!?;:'"()\\p{P}])`, "iu");
    return { regex };
  });
  CATEGORY_PATTERNS.set(category, patterns);
}

export function detectCategory(caption: string, hashtags: string[]): string {
  const text = (caption + " " + hashtags.join(" #")).toLowerCase();

  let bestCategory = "other";
  let bestScore = 0;

  for (const [category, patterns] of CATEGORY_PATTERNS) {
    const score = patterns.filter((p) => p.regex.test(text)).length;
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  }

  return bestCategory;
}
