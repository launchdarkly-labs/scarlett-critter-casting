# Day 8: All I Want for Christmas is Observable Multi-Modal Agentic Systems 🎄
## How session replay + online evals revealed what's really happening in my holiday pet casting app

**[Get Started with LaunchDarkly's AI Observability](https://launchdarkly.com/ai-configs)** *(Note: Verify this link works)*

---

## 🎁 The Discoveries That Changed Everything

I built a Christmas pet casting app that allows users to upload a photo, answer a personality quiz, then an AI casts your pet in a nativity play complete with a DALL-E generated costume. Fun, right?

To gain better visibility in how my app was performing, I added LaunchDarkly's session replay and online evals. What I found was better than any gift under the tree:

- **73% of cats were being cast as sheep** (we fixed it!)
- **Zero Golden Retrievers have ever been cast as Wise Men** (apparently too friendly for wisdom)
- **Chihuahuas are 89% angels or donkeys**—no in-between
- **After 10 PM, pets are 3x more likely to be angels** (divine intervention... or token exhaustion?)

How did I uncover these patterns? Two tools working together like milk 🥛 and cookies 🍪: **session replay** shows me *what* users do, and **online evaluations** show me *if* my AI made good decisions. Each is useful alone, but together they reveal the complete picture of how your AI app actually works in production.

---

## 🎨 See the App in Action

<details open>
<summary><b>📸 Screenshot 1 of 6: Welcome screen</b></summary>
<div align="center">
  <img src="public/images/screenshot_1.png" width="600" alt="Welcome Screen - Start your pet's casting journey"/>
  <p><i>Start your pet's magical journey to the nativity</i></p>
</div>
</details>

<details>
<summary><b>📸 Screenshot 2 of 6: Personality quiz</b></summary>
<div align="center">
  <img src="public/images/screenshot_2.png" width="600" alt="Personality Quiz - Answer questions about your pet"/>
  <p><i>Answer fun questions about your pet's personality</i></p>
</div>
</details>

<details>
<summary><b>📸 Screenshot 3 of 6: Photo upload</b></summary>
<div align="center">
  <img src="public/images/screenshot_3.png" width="600" alt="Photo Upload - Optional photo for better casting"/>
  <p><i>Upload a photo for more personalized casting (optional)</i></p>
</div>
</details>

<details>
<summary><b>📸 Screenshot 4 of 6: AI casting result</b></summary>
<div align="center">
  <img src="public/images/screenshot_4.png" width="600" alt="AI Casting Result - Your pet's role revealed"/>
  <p><i>Discover which nativity character your pet will play</i></p>
</div>
</details>

<details>
<summary><b>📸 Screenshot 5 of 6: AI casting result with eval score</b></summary>
<div align="center">
  <img src="public/images/screenshot_5.png" width="600" alt="Generated Costume - DALL-E creates the outfit"/>
  <p><i>See your complete result with the AI evaluation score</i></p>
</div>
</details>

<details>
<summary><b>📸 Screenshot 6 of 6: Another generation</b></summary>
<div align="center">
  <img src="public/images/screenshot_6.png" width="600" alt="Final Result - Complete with evaluation score"/>
  <p><i>Generate a custom costume for your pet</i></p>
</div>
</details>

---

## ⏱️ Discovery #1: The 40-Second Patience Threshold

I wanted to understand how users experienced the wait time in my app. The complete AI casting process involves multiple steps: personality analysis (2-3s), role matching (1-2s), DALL-E 3 costume generation (25-35s), and evaluation scoring (2-3s). That's 30-45 seconds total—a long time to stare at a spinner wondering if something broke.

### What is Session Replay?

LaunchDarkly's session replay lets you watch recordings of real user sessions. You see exactly what users see: mouse movements, clicks, scrolling, hesitation, and rage clicks. It's like looking over someone's shoulder as they use your app.

I integrated session replay to answer a simple question: *Where are users dropping off, and why?*

![Placeholder: Screenshot of LaunchDarkly Session Replay dashboard showing a recorded user session]
*Caption: Session replay lets you watch exactly how users interact with your app*

### What the Data Revealed

Here's what I observed across my first 50 sessions:

**Without Progress Steps (n=20 early sessions):**
```
0-10 seconds:  20/20 still watching (100%)
10-20 seconds: 18/20 still watching (90%)
20-30 seconds: 14/20 still watching (70%) ← rage clicks begin
30-40 seconds:  9/20 still watching (45%) ← tab switching detected
40+ seconds:    7/20 still watching (35% completion rate)
```

**With Progress Steps (n=30 sessions after the fix):**
```
0-10 seconds:  30/30 still watching (100%)
10-20 seconds: 29/30 still watching (97%)
20-30 seconds: 25/30 still watching (83%)
30-40 seconds: 23/30 still watching (77%)
40+ seconds:   24/30 still watching (80% completion rate!)
```

Progress steps more than **doubled** my completion rate going from 35% to 80%.

### What Are Progress Steps?

Progress steps are UI elements I added to show users what's happening during the AI processing. Instead of a generic spinner, users now see:

```
⏳ Step 1: AI Casting Decision
⏳ Step 2: Generating Costume Image (10-30s)
⏳ Step 3: Evaluation Scoring

As each completes:
✅ Step 1: AI Casting Decision
⏳ Step 2: Generating Costume Image (10-30s)
⏳ Step 3: Evaluation Scoring
```

![Placeholder: Screenshot or GIF showing the progress steps UI in the app during loading]
*Caption: Progress steps tell users what's happening at each stage*

### The Key Insight

Session replay showed me users hovering over the back button at around 25 seconds, cursor drifting toward the tab bar. But when they saw "Step 2: Generating Costume Image (10-30s)," they relaxed. They understood DALL-E was creating their pet's costume and they weren't looking at a frozen app.

**The lesson:** Users will wait for AI, but only if they know the AI is working hard, not hardly working.

---

## 🎅 Discovery #2: Session Replay + Online Evals = The Complete Picture

Here's where it gets interesting. Session replay shows *effectiveness*, like are users completing the flow? Online evaluations show *quality*, more specifically, did the AI make good decisions? Together, they answer questions neither can answer alone.

### What Are Online Evaluations?

LaunchDarkly's online evals use a model-agnostic judge (essentially an AI that evaluates other AI outputs) to automatically score every AI decision in production. For my app, I configured an accuracy evaluation that scores how well the casting matches the pet's personality.

![Placeholder: Screenshot of LaunchDarkly Online Evals dashboard showing evaluation scores over time]
*Caption: Online evals automatically score every AI decision in production*

### When Things Go Wrong: The Speed-Running Corgi

Let me walk you through a real session that shows why you need both tools.

**What Session Replay Showed:**
- Quiz completed in 8 seconds (world record speed)
- No photo uploaded
- Waited the full 31 seconds for results
- Got result: "Sheep"
- Immediate rage clicks on the sheep image
- Left without saving

From session replay alone, I could guess the user was unhappy. But was it a bad casting? Did the AI fail?

**What Online Evaluation Showed:**
- Eval Score: 38/100 ❌
- Reasoning: "Costume contains unsafe elements: eyeliner, ribbons"

Wait, what? The AI suggested a costume with face paint and ribbons, and the eval flagged it as unsafe?

**The Real Problem:**

The out-of-the-box accuracy eval is *very* safety-conscious. Here's what it actually said:
- "Costume includes eyeliner which could be harmful to pets"
- "Ribbons pose entanglement risk"
- "Bells are a choking hazard"

The eval thinks we're putting *actual* ribbons on *actual* cats. It doesn't realize these are AI-generated images. When the casting suggests "sparkly collar with bells," the eval judge practically calls animal services.

**The Combined Insight:** This user rushed through the quiz (giving the AI minimal personality data), got a generic role, AND received a low score because the eval was worried about imaginary safety hazards. About 40% of my low scores are the eval being overprotective about digital costumes, not bad casting.

---

### When Things Go Right: The Perfect Match

**What Session Replay Showed:**
- 45 seconds on the quiz (reading each option carefully)
- Uploaded a photo and waited for processing
- Spent 2+ minutes on the results page
- Downloaded the image multiple times
- Shared via the share button

**What Online Evaluation Showed:**
- Eval Score: 96/100 ⭐⭐⭐⭐⭐
- Reasoning: "Personality perfectly matches role archetype"
- Photo bonus: "Visual traits enhanced casting accuracy"

**The Pattern:** Time invested = quality received. The AI rewards thoughtfulness.

---

## 📸 Discovery #3: The Photo Upload Comedy Gold Mine

Session replay revealed what photos people *actually* upload:

```
Photo Upload Analysis (n=18 sessions with uploads):
- 12 (67%) Normal pet photos
-  2 (11%) Screenshots of pet photos on their phone
-  1 (6%)  Multiple pets in one photo (chaos ensues)
-  1 (6%)  Blurry "pet in motion" disaster
-  1 (6%)  Stock photo of their breed (cheater!)
-  1 (6%)  Cat mid-yawn (see below)
```

**My Favorite Session:** Someone uploaded a photo of their cat mid-yawn. The AI vision model described it as "displaying fierce predatory behavior." The cat was cast as "Protective Father." Eval score: 91/100. The owner downloaded it immediately.

**The Winner:** Someone's hamster photo that was 90% cage bars. The AI somehow extracted "small fuzzy creature behind geometric patterns" and cast it as "Shepherd" because "clearly experienced at navigating barriers." Eval score: 87/100. I can't argue with the logic.

---

## 🎄 The Magic Formula: What Each Tool Reveals

Here's what I learned about when to use each tool—and why you need both:

| Scenario | Session Replay Alone | Online Evals Alone | Both Together |
|----------|---------------------|-------------------|---------------|
| User leaves quickly | "They dropped off at 25 seconds" | No data (they didn't complete) | "They left because no progress indicator" |
| User rage clicks result | "They seem unhappy" | "Score: 92/100 - great match!" | "Great AI output, but UI confused them" |
| User completes but doesn't save | "Completed flow, didn't convert" | "Score: 38/100 - safety concerns" | "Low score scared them off (but score was wrong)" |
| User downloads multiple times | "Very engaged!" | "Score: 96/100" | "High quality = high engagement" |

**The big insight:** 40% of my low scores aren't bad casting, but are actually the eval being overprotective about imaginary costume safety. Users see these low scores and think the app doesn't work well, when really the AI did fine.

![Placeholder: Side-by-side screenshot showing Session Replay on left and Online Evals dashboard on right]
*Caption: Session replay (left) shows user behavior; online evals (right) show AI quality*

---

## 🔔 Your Turn: Add Observability to Your AI App

Ready to see what's really happening in your AI application? Here's how to get started:

### Step 1: Install the Packages

```bash
npm install @launchdarkly/observability
npm install @launchdarkly/session-replay
```

### Step 2: Initialize with Observability

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

### Step 3: Configure Online Evaluations in the Dashboard

**3a. Create your AI Config**

Navigate to AI Configs in your LaunchDarkly dashboard and create a new configuration for your LLM.

![Placeholder: Screenshot of LaunchDarkly dashboard - AI Configs section with "Create" button highlighted]
*Caption: Create a new AI Config in the LaunchDarkly dashboard*

**3b. Enable Automatic Accuracy Scoring**

In your AI Config, click "Add Judge" to enable online evaluations.

![Placeholder: Screenshot showing the "Add Judge" button in an AI Config]
*Caption: Add a judge to enable automatic evaluation of AI outputs*

**3c. Set Accuracy Weight**

Set the accuracy weight to 100% for production monitoring. This tells the judge to focus on whether the AI output matches the input context.

![Placeholder: Screenshot of judge configuration with accuracy slider set to 100%]
*Caption: Configure accuracy weight based on what matters for your use case*

**3d. Save and Monitor**

Once saved, every AI request will be automatically evaluated. Watch your scores in real-time.

![Placeholder: Screenshot of the Online Evals dashboard showing real-time scores and trends]
*Caption: Monitor AI quality scores in real-time*

### Step 4: Connect the Dots

Now you have both tools running. Here's what each tells you:

**Session Replay Shows You:**
- Where users drop off in your flow
- What confuses them (hesitation, back-and-forth)
- When they rage click (frustration signals)
- How long they're willing to wait

![Placeholder: Screenshot of Session Replay showing a user session with rage click indicators]
*Caption: Session replay highlights frustration signals like rage clicks*

**Online Evals Show You:**
- AI decision accuracy scores (0-100)
- Why certain outputs scored low
- Patterns in good vs. bad outputs
- Quality trends over time

![Placeholder: Screenshot of Online Evals showing score distribution and trend over time]
*Caption: Online evals track AI quality with automatic scoring*

**Together They Reveal:**
- *Why* users are unhappy (AI quality? UX issue? Both?)
- Whether good AI outputs are being presented well
- Whether bad AI outputs are recoverable with better UX
- The complete story of your AI app's performance

---

## 📚 Resources

- 📖 **[Full Implementation Guide](https://github.com/launchdarkly-labs/scarlett-critter-casting)** - See how this pet app implements both features
- 📚 **[Session Replay Tutorial](https://launchdarkly.com/docs/tutorials/detecting-user-frustration-session-replay)** - Official guide for detecting user frustration
- 🎯 **[When to Add Online Evals](https://launchdarkly.com/docs/tutorials/when-to-add-online-evals)** - Learn when and how to implement AI evaluation

---

## 🎅 Try It Yourself

🎄 **Cast your pet:** [https://scarlett-critter-casting.onrender.com/](https://scarlett-critter-casting.onrender.com/) 🐾

See your eval score ⭐. Understand why your cat is a shepherd 🐑 and your dog is an angel 👼. The AI has spoken—and now you can see exactly how much to trust it! ✨

---

## 🎁 Ready to Add AI Observability to Your Apps?

Don't let your AI operate in the dark this holiday season. Get complete visibility into your multi-modal AI systems with LaunchDarkly's online evaluations and session replay.

**[Start Your Free Trial](https://launchdarkly.com/start-trial)** | **[Learn More About AI Configs](https://launchdarkly.com/ai-configs)** | **[Read the Docs](https://docs.launchdarkly.com/home/ai/online-evals)**