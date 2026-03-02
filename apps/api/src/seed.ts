import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { calculateViralScore } from "./services/viral/viralScore";

const prisma = new PrismaClient();

const REELS = [
  // ── Fitness ────────────────────────────────────────────────────────────────
  {
    instagramId: "seed_fit_001",
    url: "https://www.instagram.com/reel/seed_fit_001/",
    username: "alexfitpro",
    displayName: "Alex Fitness",
    thumbnailUrl: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400&h=711&fit=crop",
    caption: "Nobody talks about THIS but your morning routine is killing your gains 💀 Here's what I changed after 6 years of training #fitness #workout #gym #morningroutine #gains",
    hashtags: ["fitness", "workout", "gym", "morningroutine", "gains"],
    audioName: "Monkeys Spinning Monkeys",
    isAudioTrending: true,
    views: 4_800_000,
    likes: 312_000,
    comments: 8_400,
    duration: 28,
    category: "fitness",
    postedAt: new Date(Date.now() - 18 * 60 * 60 * 1000),
  },
  {
    instagramId: "seed_fit_002",
    url: "https://www.instagram.com/reel/seed_fit_002/",
    username: "liftwithjordan",
    displayName: "Jordan Lifts",
    thumbnailUrl: "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=400&h=711&fit=crop",
    caption: "I ate 4000 calories for 30 days straight. This is what happened to my body 👇 #bulkingseason #gym #fitness #bodybuilding",
    hashtags: ["bulkingseason", "gym", "fitness", "bodybuilding"],
    audioName: "Original Audio",
    isAudioTrending: false,
    views: 1_200_000,
    likes: 89_000,
    comments: 3_200,
    duration: 45,
    category: "fitness",
    postedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
  },
  // ── Finance ────────────────────────────────────────────────────────────────
  {
    instagramId: "seed_fin_001",
    url: "https://www.instagram.com/reel/seed_fin_001/",
    username: "wealthwithwill",
    displayName: "Will Chen",
    thumbnailUrl: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400&h=711&fit=crop",
    caption: "I made $47k last month from my phone. Here are the 3 apps I used every single day 🤳💰 #sidehustle #personalfinance #makemoneyonline #passiveincome",
    hashtags: ["sidehustle", "personalfinance", "makemoneyonline", "passiveincome"],
    audioName: "Rich Girl - Gwen Stefani (sped up)",
    isAudioTrending: true,
    views: 7_200_000,
    likes: 445_000,
    comments: 18_700,
    duration: 32,
    category: "finance",
    postedAt: new Date(Date.now() - 10 * 60 * 60 * 1000),
  },
  {
    instagramId: "seed_fin_002",
    url: "https://www.instagram.com/reel/seed_fin_002/",
    username: "investingwithkira",
    displayName: "Kira Investments",
    thumbnailUrl: "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=400&h=711&fit=crop",
    caption: "Your bank is quietly stealing from you every single month. Here's how to stop it 🏦 #personalfinance #investing #moneytips #financialfreedom",
    hashtags: ["personalfinance", "investing", "moneytips", "financialfreedom"],
    audioName: "Original Audio",
    isAudioTrending: false,
    views: 890_000,
    likes: 56_000,
    comments: 4_100,
    duration: 38,
    category: "finance",
    postedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  },
  // ── Food ──────────────────────────────────────────────────────────────────
  {
    instagramId: "seed_food_001",
    url: "https://www.instagram.com/reel/seed_food_001/",
    username: "cookingwithnico",
    displayName: "Nico Cooks",
    thumbnailUrl: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=711&fit=crop",
    caption: "5 ingredient pasta that tastes better than any restaurant 🍝 Ready in 12 minutes #pasta #easyrecipe #foodtok #cooking #recipe",
    hashtags: ["pasta", "easyrecipe", "foodtok", "cooking", "recipe"],
    audioName: "Ella Baila Sola - Eslabon Armado",
    isAudioTrending: true,
    views: 9_100_000,
    likes: 621_000,
    comments: 22_000,
    duration: 18,
    category: "food",
    postedAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
  },
  {
    instagramId: "seed_food_002",
    url: "https://www.instagram.com/reel/seed_food_002/",
    username: "tastebymaya",
    displayName: "Maya Taste",
    thumbnailUrl: "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=400&h=711&fit=crop",
    caption: "POV: You discover this trick at 2am and can't stop making it 😭🍫 #chocolate #dessert #easyrecipe #foodie #recipe",
    hashtags: ["chocolate", "dessert", "easyrecipe", "foodie", "recipe"],
    audioName: "Calm Down - Rema",
    isAudioTrending: false,
    views: 3_400_000,
    likes: 218_000,
    comments: 7_800,
    duration: 22,
    category: "food",
    postedAt: new Date(Date.now() - 36 * 60 * 60 * 1000),
  },
  // ── Beauty ────────────────────────────────────────────────────────────────
  {
    instagramId: "seed_bea_001",
    url: "https://www.instagram.com/reel/seed_bea_001/",
    username: "glamwithzara",
    displayName: "Zara Glam",
    thumbnailUrl: "https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=400&h=711&fit=crop",
    caption: "Get Ready With Me: $0 skincare routine that cleared my skin in 2 weeks (dermatologist approved) ✨ #grwm #skincare #skincareroutine #clearskin #beauty",
    hashtags: ["grwm", "skincare", "skincareroutine", "clearskin", "beauty"],
    audioName: "vampire - Olivia Rodrigo",
    isAudioTrending: true,
    views: 5_600_000,
    likes: 389_000,
    comments: 14_200,
    duration: 41,
    category: "beauty",
    postedAt: new Date(Date.now() - 14 * 60 * 60 * 1000),
  },
  {
    instagramId: "seed_bea_002",
    url: "https://www.instagram.com/reel/seed_bea_002/",
    username: "makeupbylena",
    displayName: "Lena Beauty",
    thumbnailUrl: "https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=400&h=711&fit=crop",
    caption: "I did a full glam using ONLY drugstore products under $10. The results will shock you 💄 #makeuptutorial #drugstore #makeup #beauty #grwm",
    hashtags: ["makeuptutorial", "drugstore", "makeup", "beauty", "grwm"],
    audioName: "Original Audio",
    isAudioTrending: false,
    views: 2_100_000,
    likes: 147_000,
    comments: 5_900,
    duration: 54,
    category: "beauty",
    postedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
  },
  // ── Motivation ───────────────────────────────────────────────────────────
  {
    instagramId: "seed_mot_001",
    url: "https://www.instagram.com/reel/seed_mot_001/",
    username: "mindsetwithmark",
    displayName: "Mark Mindset",
    thumbnailUrl: "https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=400&h=711&fit=crop",
    caption: "Stop waiting for motivation. This 3-second rule changed my entire life 🧠⚡ #motivation #mindset #productivity #selfimprovement #success",
    hashtags: ["motivation", "mindset", "productivity", "selfimprovement", "success"],
    audioName: "It's Not Living (If It's Not With You)",
    isAudioTrending: true,
    views: 6_300_000,
    likes: 512_000,
    comments: 19_400,
    duration: 15,
    category: "motivation",
    postedAt: new Date(Date.now() - 8 * 60 * 60 * 1000),
  },
  {
    instagramId: "seed_mot_002",
    url: "https://www.instagram.com/reel/seed_mot_002/",
    username: "dailydrivepodcast",
    displayName: "Daily Drive",
    thumbnailUrl: "https://images.unsplash.com/photo-1434494878577-86c23bcb06b9?w=400&h=711&fit=crop",
    caption: "The harsh truth about why you're still broke at 25 (nobody wants to say this) 💀 #motivation #personalfinance #goals #mindset",
    hashtags: ["motivation", "personalfinance", "goals", "mindset"],
    audioName: "Original Audio",
    isAudioTrending: false,
    views: 1_800_000,
    likes: 134_000,
    comments: 8_700,
    duration: 29,
    category: "motivation",
    postedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
  },
  // ── Comedy ────────────────────────────────────────────────────────────────
  {
    instagramId: "seed_com_001",
    url: "https://www.instagram.com/reel/seed_com_001/",
    username: "dankmemesfr",
    displayName: "Real Memes",
    thumbnailUrl: "https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=400&h=711&fit=crop",
    caption: "When the WiFi goes out and you have to talk to your family 💀💀💀 #relatable #comedy #funny #memes",
    hashtags: ["relatable", "comedy", "funny", "memes"],
    audioName: "Tití Me Preguntó - Bad Bunny",
    isAudioTrending: true,
    views: 11_400_000,
    likes: 890_000,
    comments: 31_000,
    duration: 9,
    category: "comedy",
    postedAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
  },
  {
    instagramId: "seed_com_002",
    url: "https://www.instagram.com/reel/seed_com_002/",
    username: "sketchesbysam",
    displayName: "Sam Sketches",
    thumbnailUrl: "https://images.unsplash.com/photo-1527224857830-43a7acc85260?w=400&h=711&fit=crop",
    caption: "Me explaining to my mom why I need a new phone for 'content creation' 📱😭 #comedy #relatable #funny #contentcreator",
    hashtags: ["comedy", "relatable", "funny", "contentcreator"],
    audioName: "Flowers - Miley Cyrus",
    isAudioTrending: false,
    views: 4_200_000,
    likes: 298_000,
    comments: 12_600,
    duration: 13,
    category: "comedy",
    postedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  },
];

async function main() {
  console.log("🌱 Seeding trending reels...\n");

  let created = 0;
  let skipped = 0;

  for (const reel of REELS) {
    const viralScore = calculateViralScore({
      views: reel.views,
      likes: reel.likes,
      comments: reel.comments,
      isAudioTrending: reel.isAudioTrending,
      postedAt: reel.postedAt,
    });

    try {
      await prisma.trendingReel.upsert({
        where: { instagramId: reel.instagramId },
        create: { ...reel, viralScore },
        update: { viralScore },
      });
      console.log(`  ✓ @${reel.username} — ${reel.category} — score ${viralScore}`);
      created++;
    } catch (err) {
      console.error(`  ✗ Failed: ${reel.instagramId}`, err);
      skipped++;
    }
  }

  console.log(`\n✅ Done. ${created} reels seeded, ${skipped} skipped.\n`);
  console.log("Now visit http://localhost:3000/trending\n");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
