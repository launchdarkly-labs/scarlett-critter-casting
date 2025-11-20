# Day 8: All I want for Christmas is observable multi-modal agentic systems 🎁
## How session replay + online evals revealed how my holiday pet app actually works 🎅

**[Get Started with LaunchDarkly's AI Observability](https://launchdarkly.com/ai-configs)**

**🎄 What users do and if my AI is working 🎄**

I added LaunchDarkly observability to my Christmas-play pet casting app thinking I'd catch bugs. Instead, I unwrapped the perfect gift 🎁: Session replay shows me WHAT users do. Online evaluations show me IF my model made the right casting decision with real-time accuracy scores. Together, they're like milk 🥛 and cookies 🍪: each good alone, but magical together for production AI monitoring.

## ⏱️ Discovery #1: Users' 40-second patience threshold ❄️

### Session replay revealed 🔍:

```
WITHOUT Progress Steps (n=20 early sessions):
0-10 seconds: 20/20 still watching (100%)
10-20 seconds: 18/20 still watching (90%)
20-30 seconds: 14/20 still watching (70%) - rage clicks begin
30-40 seconds: 9/20 still watching (45%) - tab switching detected
40+ seconds: 7/20 still watching (35% stay)

WITH Progress Steps (n=30 after adding them):
0-10 seconds: 30/30 still watching (100%)
10-20 seconds: 29/30 still watching (97%)
20-30 seconds: 25/30 still watching (83%)
30-40 seconds: 23/30 still watching (77%)
40+ seconds: 24/30 still watching (80% stay!)

Critical Discovery: Progress steps more than DOUBLED
completion rate (35% → 80%)
```

### This made the difference:

**Clear progress steps:**
```
⏳ Step 1: AI Casting Decision
⏳ Step 2: Generating Costume Image (10-30s)
⏳ Step 3: eval Evaluation

As each completes:
✅ Step 1: AI Casting Decision
⏳ Step 2: Generating Costume Image (10-30s)
⏳ Step 3: eval Evaluation
```

Session replay showed users hovering over the back button at 25 seconds, then relaxing when they saw "Step 2: Generating Costume Image (10-30s)," they knew what was happening AND how long it would take.

## 🎅 Discovery #2: Observability + online evaluations give the complete picture 🤖

Here's where it gets magical ✨. Session replay shows EFFECTIVENESS. Online evaluations show QUALITY with automatic accuracy scoring. Together, they reveal everything 🎁 for comprehensive AI monitoring.

### Example: The speed-running corgi owner

**Session Replay Showed:**
- Quiz completed in 8 seconds (world record)
- No photo uploaded
- Waited full 31 seconds
- Got result: "Sheep"
- Immediate rage clicks on the sheep image
- Left without saving

**Online Evaluation Results:**
- eval Score: 38/100 ❌
- Reasoning: "Costume contains unsafe elements: eyeliner, ribbons"
- Wait, what? The AI suggested face paint and ribbons, evals eval said NO

**The Real Problem:** Online evals use a model-agnostic eval (MAJ) - an AI agent that evaluates other AI outputs for either quality, safety, and accuracy. The out-of-the-box accuracy eval is VERY safety-conscious. The eval's actual comments:
- "Costume includes eyeliner which could be harmful to pets" (It's a DALL-E image!)
- "Ribbons pose entanglement risk" 
- "Bells are a choking hazard" (It's AI-generated art!)

About 40% of low scores are actually the eval being overprotective about imaginary safety issues, not bad casting.

**The Combined Insight:** Speed-runners get generic roles AND the eval writes safety warnings about digital costumes. Users see these low scores and think the app doesn't work well.

### Example: The perfect match

**Session Replay Showed:**
- 45 seconds on quiz (reading each option)
- Uploaded photo, waited for processing
- Spent 2 minutes on results page
- Downloaded image multiple times

**Online Evaluation Results:**
- eval Score: 96/100 ⭐⭐⭐⭐⭐
- Reasoning: "Personality perfectly matches role archetype"
- Photo bonus: "Visual traits enhanced casting accuracy"

**The Pattern:** Time invested = Quality received. The AI rewards thoughtfulness.

## 📸 Discovery #3: The photo upload comedy gold mine 🎄

Session replay revealed what photos people ACTUALLY upload 🐾:

```
Photo Upload Analysis (n=18 who uploaded):
- 12 (67%) Normal pet photos
- 2 (11%) Screenshots of pet photos on their phone
- 1 (6%) Multiple pets in one photo (chaos)
- 1 (6%) Blurry "pet in motion" disaster
- 1 (6%) Stock photo of their breed (cheater!)
```

**My Favorite Session:** Someone uploaded a photo of their cat mid-yawn. The AI vision model described it as "displaying fierce predatory behavior." The cat was cast as a "Protective Father." eval score: 91/100. The owner downloaded it immediately.

**The Winner:** Someone's hamster photo that was 90% cage bars. The AI somehow extracted "small fuzzy creature behind geometric patterns" and cast it as "Shepherd" because "clearly experienced at navigating barriers." eval score: 87/100.

## 🎄 The magic formula: Why this combo works (and what surprised me) 🎁

```
Without Observability:
"The app seems slow" → ¯\_(ツ)_/¯
"We have 20 visitors but 7 completions" → Where do they drop?

With Session Replay ONLY:
"User got sheep and rage clicked; maybe left angry" → Was this a bad match?

With Model-Agnostic eval ONLY:
"eval: 22/100 - Eyeliner unsafe for pets" → How did the user react?
"eval: 96/100 - Perfect match!" → How did this compare to the image they uploaded?

With BOTH:
"User rushed, got sheep with ribbons, eval panicked about safety"
→ The OOTB eval treats image generation prompts like real costume instructions

"40% of low scores are costume safety, not bad matching"
→ Need custom eval criteria (coming soon!)

"Users might think low score = bad casting, but it's often = protective eval"
→ Would benefit from custom eval criteria to avoid this confusion
```

**The Hilarious Reality:** The eval thinks we're putting ACTUAL ribbons on ACTUAL cats. It doesn't realize these are AI-generated images. So when the casting suggests "sparkly collar with bells," the eval judge practically calls animal services.

## 🎁 Your turn: See the complete picture 🔔

Want to add this observability magic to your own app? Here's how 🎅:

### 1. Install the packages
```javascript
npm install @launchdarkly/observability
npm install @launchdarkly/session-replay
```

### 2. Initialize with observability
```javascript
import { initialize } from 'launchdarkly-js-client-sdk';
import Observability from '@launchdarkly/observability';
import SessionReplay from '@launchdarkly/session-replay';

const ldClient = initialize(clientId, user, {
  plugins: [
    new Observability({
      manualStart: false
    }),
    new SessionReplay({
      privacySetting: 'strict' // Masks sensitive data
    })
  ]
});
```

### 3. Configure online evaluations in dashboard
- Create your AI Config in LaunchDarkly for LLM evaluation
- Enable automatic accuracy scoring for production monitoring
- Set accuracy weight to 100% for production AI monitoring
- Watch as online evaluations analyze every AI agent decision in real-time

### 4. Connect the dots
Session replay shows you:
- Where users drop off

- What confuses them
- When they rage click
- How long they wait

Online evals shows you:
- AI decision accuracy scores
- Why certain outputs scored low
- Pattern of good vs bad castings
- Safety concerns (even for pixels!)

Together they reveal the complete story of your AI app.

### Resources to get started:
📖 **[Full Implementation Guide](https://github.com/launchdarkly-labs/scarlett-critter-casting)** - See how this pet app implements both features

📚 **[Session Replay Tutorial](https://launchdarkly.com/docs/tutorials/detecting-user-frustration-session-replay)** - Official LaunchDarkly guide for detecting user frustration

🎯 **[When to Add Online Evals](https://launchdarkly.com/docs/tutorials/when-to-add-online-evals)** - Learn when and how to implement AI evaluation

The real magic is in having observability AND online evals. 

## 🎅 Try it yourself 🎄

🎄 Cast your pet: https://scarlett-critter-casting.onrender.com/ 🐾

See your eval score ⭐. Understand why your cat is a shepherd 🐑 and your dog is an angel 👼. The AI has spoken, and now you can see exactly how much to trust it! ✨.

---

## 🎁 Ready to add AI observability to your multi-modal agents?

Don't let your AI operate in the dark this holiday season. Get complete visibility into your multi-modal AI systems with LaunchDarkly's online evaluations and session replay.

**[Start Your Free Trial](https://launchdarkly.com/start-trial)**
**[Learn More About AI Configs](https://launchdarkly.com/ai-configs)**
**[Read the Docs](https://docs.launchdarkly.com/home/ai/online-evals)**
