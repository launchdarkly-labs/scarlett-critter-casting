import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { init, type LDContext } from '@launchdarkly/node-server-sdk';
import { initAi } from '@launchdarkly/server-sdk-ai';
import { Observability } from '@launchdarkly/observability-node';
import OpenAI from 'openai';
import path from 'path';
import multer from 'multer';
import sharp from 'sharp';
import fs from 'fs';
import { createReadStream } from 'fs';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit - we'll resize on server
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Initialize LaunchDarkly
const sdkKey = process.env.LAUNCHDARKLY_SDK_KEY;
const aiConfigKey = process.env.LAUNCHDARKLY_AI_CONFIG_KEY || 'christmas-critters';

if (!sdkKey) {
  console.error('*** Please set LAUNCHDARKLY_SDK_KEY in .env');
  process.exit(1);
}

const ldClient = init(sdkKey, {
  plugins: [
    new Observability(),
  ],
});

const context: LDContext = {
  kind: 'user',
  key: 'christmas-critter-director',
  name: 'Holiday User',
};

// Initialize OpenAI for image generation
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Store initialization promise
const ldInitPromise = ldClient.waitForInitialization().then(() => {
  console.log('✅ LaunchDarkly SDK initialized successfully');
  return true;
}).catch((error) => {
  console.error('❌ LaunchDarkly SDK initialization failed:', error);
  return false;
});

const aiClient = initAi(ldClient);

// API endpoint for pet casting with photo upload
app.post('/api/cast', upload.single('photo'), async (req, res) => {
  try {
    // Ensure LaunchDarkly is initialized
    const ldInitialized = await ldInitPromise;
    if (!ldInitialized) {
      console.warn('LaunchDarkly not fully initialized, proceeding with potential fallback');
    }

    const { name, type, breed } = req.body;

    // Handle answers parsing - FormData might send it as a string already
    let answers;
    try {
      answers = JSON.parse(req.body.answers || '[]');
    } catch (parseError) {
      console.error('Failed to parse answers:', parseError);
      console.error('Raw value:', req.body.answers);
      // If it's a comma-separated string, convert to array
      if (typeof req.body.answers === 'string' && req.body.answers.includes(',')) {
        answers = req.body.answers.split(',');
      } else {
        answers = [];
      }
    }

    const uploadedPhoto = req.file;

    // Map answer keys to descriptive traits for better AI understanding
    const answerDescriptions = [
      { a: 'attention-loving center stage', b: 'shy ninja', c: 'friendly social butterfly', d: 'quirky dramatic' },
      { a: 'demands attention', b: 'subtle protests', c: 'innocent after mischief', d: 'dramatic performances' },
      { a: 'party animal', b: 'mysterious watcher', c: 'professional greeter', d: 'selective socializer' },
      { a: 'acrobatic performer', b: 'finds sunny spots', c: 'fetches anything', d: 'talks back' },
      { a: 'fashion model', b: 'freeze like statue', c: 'ready for accessories', d: 'escapes immediately' }
    ];

    const answerText = answers.map((ans: string, idx: number) =>
      answerDescriptions[idx][ans as keyof typeof answerDescriptions[number]]
    ).join(', ');

    let role = 'The Bright Star';
    let costumeDescription = 'festive Christmas costume';
    let casting = '';
    let imagePrompt = '';
    let petDescription: any = null;

    // Try to use LaunchDarkly AI config (v0.14.0+)
    let judgeScore: number | null = null;
    let judgeComments: string | null = null;

    // Convert uploaded photo to base64 for AI analysis
    let imageBase64: string | null = null;
    if (uploadedPhoto) {
      try {
        // Resize for API (smaller size for faster processing)
        const pngBuffer = await sharp(uploadedPhoto.buffer)
          .resize(512, 512, {
            fit: 'inside',
            withoutEnlargement: true
          })
          .png()
          .toBuffer();
        imageBase64 = pngBuffer.toString('base64');
      } catch (imgError) {
        console.error('Error processing image for AI:', imgError);
      }
    }

    // CALL 1: Static Vision Parser (always runs when photo uploaded)
    if (imageBase64) {
      try {
        console.log('=== CALL 1: Vision Parser ===');
        const visionResponse = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [{
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analyze this pet photo and extract exact appearance details. Be very specific about colors, markings, and features. Respond with valid JSON only.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${imageBase64}`
                }
              }
            ]
          }],
          max_tokens: 500,
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "pet_description",
              schema: {
                type: "object",
                properties: {
                  appearance: {
                    type: "string",
                    description: "Detailed color and marking description from photo"
                  },
                  distinctiveFeatures: {
                    type: "array",
                    items: { type: "string" },
                    description: "List of unique features"
                  },
                  expression: {
                    type: "string",
                    description: "Facial expression and body language"
                  },
                  fullDescription: {
                    type: "string",
                    description: "Complete natural description for image generation"
                  }
                },
                required: ["appearance", "distinctiveFeatures", "expression", "fullDescription"],
                additionalProperties: false
              },
              strict: true
            }
          }
        });

        petDescription = JSON.parse(visionResponse.choices[0].message.content || '{}');
        console.log('Vision parser result:', petDescription);
      } catch (visionError) {
        console.error('Vision parsing failed:', visionError);
        // Continue without pet description - LaunchDarkly will work with breed/personality only
      }
    }

    try {
      // CALL 2: Try to create chat with LaunchDarkly AI

      // Default value to use when config is not enabled
      const defaultValue = {
        enabled: false
      };

      const chat = await aiClient.createChat(aiConfigKey, context, defaultValue, {
        petName: name,
        petType: type,
        breed: breed || 'unknown breed',
        personality: answerText,
        // Pass extracted pet description as text variables (from Call 1)
        appearance: petDescription?.appearance || '',
        distinctiveFeatures: petDescription?.distinctiveFeatures?.join(', ') || '',
        expression: petDescription?.expression || '',
        fullDescription: petDescription?.fullDescription || ''
      });


      // Check if chat is available
      if (!chat) {
        console.log('LaunchDarkly AI chat configuration is not enabled');
        throw new Error('LaunchDarkly chat not available');
      }

      // The user prompt will be substituted with the variables we passed
      // The LaunchDarkly config should have the full prompt template
      const userPrompt = 'Generate the casting for this pet';

      // Invoke chat and get response - this will use the prompts from LaunchDarkly config
      const chatResponse = await chat.invoke(userPrompt);
      const responseContent = chatResponse.message?.content || '';

      try {
        // Clean markdown code blocks if present
        let cleanContent = responseContent;
        if (responseContent.includes('```json')) {
          cleanContent = responseContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        } else if (responseContent.includes('```')) {
          cleanContent = responseContent.replace(/```\n?/g, '').trim();
        }

        // Parse JSON response
        const castingResponse = JSON.parse(cleanContent);
        role = castingResponse.role || 'The Bright Star';
        costumeDescription = castingResponse.costume || 'festive Christmas costume';
        imagePrompt = castingResponse.imagePrompt || '';
        // Note: petDescription already set from Call 1, not returned by LaunchDarkly
        casting = castingResponse.explanation || `${name} is perfect for the role of ${role}!`;
      } catch (parseError) {
        console.error('Failed to parse LaunchDarkly response as JSON, falling back to regex:', parseError);
        // Fallback to regex parsing for backwards compatibility
        const roleMatch = responseContent.match(/ROLE:\s*(.+)/);
        const costumeMatch = responseContent.match(/COSTUME:\s*(.+)/);
        const explanationMatch = responseContent.match(/EXPLANATION:\s*(.+)/);
        role = roleMatch ? roleMatch[1].trim() : 'The Bright Star';
        costumeDescription = costumeMatch ? costumeMatch[1].trim() : 'festive Christmas costume';
        const explanation = explanationMatch ? explanationMatch[1].trim() : `${name} the ${type} is perfect for the role of ${role} with their ${answerText} personality!`;
        casting = explanation;
      }

      // Get judge evaluations if available
      try {
        const evalResults = chatResponse ? await chatResponse.evaluations : null;
        console.log('Judge evaluation results:', evalResults ? `${evalResults.length} evaluations found` : 'None');
        if (evalResults && evalResults.length > 0) {
          // Extract judge score and comments from evaluation results
          const firstEval = evalResults[0];
          console.log('First evaluation:', JSON.stringify(firstEval, null, 2));

          // Judge data is nested in evals object
          const evalsData = (firstEval as any).evals;
          if (evalsData) {
            // Check for accuracy judge
            const accuracyJudge = evalsData['$ld:ai:judge:accuracy'];
            if (accuracyJudge && typeof accuracyJudge.score === 'number') {
              judgeScore = accuracyJudge.score * 100; // Convert to percentage
              console.log('Judge score extracted:', judgeScore);

              if (accuracyJudge.reasoning) {
                judgeComments = accuracyJudge.reasoning;
                console.log('Judge comments:', judgeComments);
              }
            }
          }
        }
      } catch (evalError) {
        console.log('Judge evaluation error:', evalError);
        // Judge evaluation not available
      }
    } catch (error) {
      console.error('LaunchDarkly AI not available, falling back to OpenAI:', error);
      // CALL 2 FALLBACK: LaunchDarkly AI not available, fall back to direct OpenAI
      // Note: petDescription already extracted from Call 1 (if photo was uploaded)
      const breedText = breed || 'mixed breed';
      const systemPrompt = `You are a brilliant casting director and pet analyst for a critter play where pets play EVERY role!

Your job is to:
1. Cast ${name}, a ${breedText} ${type}, based on their personality${petDescription ? ' and appearance' : ' and breed characteristics'}
2. Generate a creative, detailed image prompt for DALL-E 3

🎭 IMPORTANT: Consider breed characteristics! For example:
- Golden Retrievers are naturally friendly and nurturing
- Chihuahuas often think they're mighty despite their size
- Huskies are dramatic performers
- Cats have mysterious, regal qualities
- Bulldogs are loyal and protective

Available roles (traditional + fun additions):

- Angelic Messenger (the grand announcer - confident, commanding presence)
- Gentle Mother (the gentle lead - nurturing, calm, motherly)
- Protective Father (the protective companion - loyal, steady, reliable)
- The Bright Star (the shining guide - mysterious, graceful, attention-grabbing)
- Wise Pet #1, #2, or #3 (regal gift-bearers - dignified, intelligent, sophisticated)
- Shepherd (the watchful guardian - alert, protective, outdoorsy)
- Innkeeper (the gatekeeper - territorial, practical, no-nonsense)
- Sheep (the adorable ensemble - gentle, follower, fluffy if possible!)
- Drummer Pet (who bangs on everything - energetic, noisy, rhythmic)
- Camel (the dramatic transportation - thinks they're fancy, a bit extra)
- Donkey (the sassy sidekick - stubborn but lovable, carries the show)
- Herald Angel (the backup vocalist - supportive, harmonious)
- Ox in the Barn (the chill observer - calm, just vibing, eating hay)
- Random Critter in the Background (photobomber extraordinaire - goofy, scene-stealer)

Consider BOTH personality AND breed characteristics to find the PERFECT match!

ALWAYS respond with VALID JSON in this exact format:
{
  "role": "chosen play role",
  "explanation": "2-3 sentences why this role fits their personality AND appearance/breed",
  "costume": "detailed festive costume that complements their features",
  "imagePrompt": "FOCUS ON THE PET'S FACE - Close-up portrait style showing facial features clearly. ${petDescription ? 'Start with: ' + petDescription.fullDescription : 'Start with breed characteristics'}, layer personality visuals (confident stance, gentle eyes, etc.), add costume transformation (specific details like golden wings, decorative robes, festive accessories). Set in a magical holiday scene: crisp, starlit desert night near a cozy mudbrick caravan stall with warm golden glow from clay oil lamps, scattered hay and straw, twinkling stars above, geometric decorative patterns with festive touches. Create a warm, enchanting atmosphere that feels like a special holiday performance. Style: Painterly realism / children's-book illustration style. Maintain pet's unique features while adding costume. Emphasize the pet's face and expression. Secular setting; no people or religious symbols."
}

IMPORTANT IMAGE GENERATION NOTES:
- Avoid religious imagery combinations (barn + winter + animals can trigger filters)
- Use role descriptions not religious names (e.g., "Gentle Mother" not "Mary", "Protective Father" not "Joseph")
- Focus on the pet's personality, breed features, and costume details
- Use generic decorative elements, not symbolic ones
- Keep scenes people-free and secular

SAFE REPLACEMENTS FOR DALL-E TO AVOID CONTENT FILTERS:
- "Bethlehem" → "Levantine desert-inspired" or "caravan stall"
- "nativity play" → "costume party" or "play"
- "barn/stable" → "mudbrick caravan stall" or "desert waystation animal shelter"
- "winter/snow" → "crisp, starlit desert night"
- "lanterns" → "clay oil lamps"
- "star embroidery" → "geometric embroidery"
- "face mask" → "facial markings"
- "donkey ears" → "long floppy felt ears (decorative)"
- "Mary" → "Gentle Mother"
- "Joseph" → "Protective Father"
- "Angel Gabriel" → "Angelic Messenger"
- "Star of Bethlehem" → "The Bright Star"
- "manger" → "animal shelter"
- Artist names → "painterly realism / children's-book illustration style"

**Add to prompts**: "Secular setting; no people or religious symbols."`;

      let userPrompt = `Cast ${name}, a ${breedText} ${type}, in the play!

Personality traits: ${answerText}
${petDescription ? `
Appearance (from photo):
- Colors/Markings: ${petDescription.appearance}
- Distinctive Features: ${petDescription.distinctiveFeatures.join(', ')}
- Expression: ${petDescription.expression}
- Full Description: ${petDescription.fullDescription}` : ''}

Assign the PERFECT role that matches BOTH their personality AND ${petDescription ? 'appearance' : 'breed characteristics'}. Consider:
${petDescription ? `- Their exact appearance from the photo` : ''}
- Their natural breed tendencies (energy level, typical temperament, physical traits)
- Quiz personality results (how they actually behave)
- How comfortable they'd be in different roles
- Their star quality and comedic potential

You can choose ANY role!

Create a detailed, creative DALL-E prompt that:
1. FOCUSES ON THE PET'S FACE - close-up portrait style
2. ${petDescription ? `Starts with: ${petDescription.fullDescription}` : 'Starts with breed characteristics (physical traits like coat type, ears, build, typical coloring)'}
3. Layers in personality visuals (confident stance, gentle eyes, etc.)
4. Adds specific costume details (golden wings, decorative robes, festive accessories, etc.)
5. Sets scene in a magical holiday atmosphere: crisp, starlit desert night near a cozy mudbrick caravan stall with warm golden glow from clay oil lamps, scattered hay and straw, twinkling stars above, geometric decorative patterns with festive touches - create a warm, enchanting atmosphere that feels like a special holiday performance
6. Use "painterly realism / children's-book illustration style" instead of artist names
7. Add "Secular setting; no people or religious symbols" to every prompt
8. Avoid filter triggers: Use "crisp, starlit desert night" not "winter/snow", "mudbrick caravan stall" not "barn/stable", "clay oil lamps" not "lanterns", "geometric embroidery" not "star embroidery", "facial markings" not "face mask", "long floppy felt ears (decorative)" not "donkey ears"

Return a valid JSON response with role, explanation, costume, and imagePrompt.`;

      // Build messages for OpenAI fallback (text-only, no multimodal)
      // Note: If photo was uploaded, petDescription already extracted in Call 1
      const messages: any[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ];

      const chatCompletion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages,
        temperature: 0.7,
        max_tokens: 1000,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "pet_casting",
            schema: {
              type: "object",
              properties: {
                role: {
                  type: "string",
                  description: "The role assigned to the pet"
                },
                explanation: {
                  type: "string",
                  description: "2-3 sentences explaining why this pet fits the role"
                },
                costume: {
                  type: "string",
                  description: "Description of the festive pet-friendly costume"
                },
                imagePrompt: {
                  type: "string",
                  description: "Complete creative DALL-E prompt for generating the costumed pet image"
                }
              },
              required: ["role", "explanation", "costume", "imagePrompt"],
              additionalProperties: false
            },
            strict: true
          }
        }
      });

      const castingResponse = JSON.parse(chatCompletion.choices[0].message.content || '{}');
      role = castingResponse.role || 'The Bright Star';
      costumeDescription = castingResponse.costume || 'festive costume';
      imagePrompt = castingResponse.imagePrompt || '';
      // Note: petDescription already set from Call 1, don't override it
      casting = castingResponse.explanation || `${name} is perfect for the role of ${role}!`;
    }

    // Generate costume image with DALL-E 3
    let imageUrl = null;
    let finalImagePrompt = ''; // Move this outside try block for error handling
    if (process.env.OPENAI_API_KEY) {
      try {
        const breedDescription = breed ? `${breed} ${type}` : type;

        console.log('Image prompt from LaunchDarkly:', imagePrompt ? 'EXISTS' : 'EMPTY');
        console.log('Pet description available:', petDescription ? 'YES' : 'NO');
        if (petDescription) {
          console.log('Pet description details:', {
            appearance: petDescription.appearance || 'N/A',
            distinctiveFeatures: petDescription.distinctiveFeatures || [],
            expression: petDescription.expression || 'N/A',
            fullDescription: petDescription.fullDescription || 'N/A'
          });
        }

        // If we have petDescription, ensure all details are incorporated
        if (petDescription) {
          // Build the detailed pet description for focus on the face
          const fullPetDescription = [
            petDescription.fullDescription,
            `with ${petDescription.appearance}`,
            petDescription.distinctiveFeatures?.length > 0 ?
              `featuring distinctive marks: ${petDescription.distinctiveFeatures.join(', ')}` : '',
            `showing ${petDescription.expression}`
          ].filter(Boolean).join(' ');

          if (imagePrompt) {
            // Enhance the AI-generated prompt with all pet details and face focus
            finalImagePrompt = `IMPORTANT: This is a wholesome, family-friendly image for a fun pet play. For entertainment purposes only - just adorable pets in costumes!

FOCUS ON THE PET'S FACE - Close-up portrait style showing the pet's facial features clearly.

CRITICAL: The pet MUST maintain their exact natural colors and markings as described. Do not change fur color or breed characteristics. Costumes should complement, not override, their natural appearance.

${imagePrompt}

CRITICAL DETAILS TO INCLUDE (MAINTAIN EXACT COLORS):
- Pet appearance: ${petDescription.appearance}
- Distinctive features: ${petDescription.distinctiveFeatures?.join(', ')}
- Expression: ${petDescription.expression}
- Full description: ${petDescription.fullDescription}
- Costume: ${costumeDescription}

The image should clearly show the pet's face and expression with their natural breed colors, capturing their unique personality while wearing the ${role} costume.
Style: Painterly realism / children's-book illustration style, with emphasis on the pet's face and expression.
Note: This is for a lighthearted, family-friendly pet costume contest - just cute animals in costumes for fun!`;
          } else {
            // Create comprehensive fallback prompt with all pet details
            finalImagePrompt = `IMPORTANT: This is a wholesome, family-friendly image for a fun pet play. For entertainment purposes only - just adorable pets in costumes!

FOCUS ON THE PET'S FACE - Close-up portrait style, photorealistic, heartwarming image of ${name}, a ${fullPetDescription}, dressed as ${role} in a play.

KEY FEATURES TO EMPHASIZE:
- Appearance: ${petDescription.appearance}
- Distinctive marks: ${petDescription.distinctiveFeatures?.join(', ')}
- Expression: ${petDescription.expression}
- The pet is wearing: ${costumeDescription}

Their personality (${answerText}) shines through their ${petDescription.expression}.
The pet looks happy and comfortable in their festive ${role} costume.

Style: Painterly realism / children's-book illustration style, focusing on the pet's face and expression.
Set in a magical holiday scene: crisp, starlit desert night near a cozy mudbrick caravan stall with warm golden glow from clay oil lamps, scattered hay and straw, twinkling stars above, geometric decorative patterns with festive touches. Warm, enchanting atmosphere that feels like a special holiday performance.
Ultra-detailed facial features, every whisker and fur tuft visible.
The pet's face should be the clear focal point, showing their unique features while wearing the ${role} costume.
Secular setting; no people or religious symbols.

Note: This is for a lighthearted, family-friendly pet costume contest - just cute animals in costumes for fun!`;
          }
        } else if (imagePrompt) {
          // Use the AI-generated prompt with face focus enhancement
          finalImagePrompt = `IMPORTANT: This is a wholesome, family-friendly image for a fun pet play. For entertainment purposes only - just adorable pets in costumes!

FOCUS ON THE PET'S FACE - Close-up portrait style showing the pet's facial features clearly.

CRITICAL: The pet must look like a real ${breedDescription} with accurate breed colors and markings. Do not change the pet's natural fur color or breed characteristics. The costume should complement their natural appearance, not override it.

${imagePrompt}

The image should emphasize the pet's face and expression, capturing their unique personality while maintaining breed-accurate colors and features.
Note: This is for a lighthearted, family-friendly pet costume contest - just cute animals in costumes for fun!`;
        } else {
          // Basic fallback without pet description
          console.log('Creating basic fallback image prompt');
          const petDesc = breedDescription;
          finalImagePrompt = `IMPORTANT: This is a wholesome, family-friendly image for a fun pet play. For entertainment purposes only - just adorable pets in costumes!

FOCUS ON THE PET'S FACE - Close-up portrait style, photorealistic, heartwarming image of a ${petDesc} named ${name} dressed as ${role} in a play.
The ${type} is wearing: ${costumeDescription}
Their personality shines through - ${answerText}
The pet looks happy and comfortable in their festive costume.

Style: Painterly realism / children's-book illustration style, with clear focus on the pet's face.
Set in a magical holiday scene: crisp, starlit desert night near a cozy mudbrick caravan stall with warm golden glow from clay oil lamps, scattered hay and straw, twinkling stars above, geometric decorative patterns with festive touches. Warm, enchanting atmosphere that feels like a special holiday performance.
Ultra-detailed facial features, every whisker and fur tuft visible.
The pet's face should be the focal point, clearly recognizable as a ${breedDescription} dressed up for the play.
Secular setting; no people or religious symbols.

Note: This is for a lighthearted, family-friendly pet costume contest - just cute animals in costumes for fun!`;
        }

        // Log the exact prompt being sent to DALL-E for debugging
        console.log('=== IMAGE PROMPT BEING SENT TO DALL-E ===');
        console.log(finalImagePrompt);
        console.log('=== END OF IMAGE PROMPT ===');
        console.log('Prompt length:', finalImagePrompt.length, 'characters');

        const imageResponse = await openai.images.generate({
          model: "dall-e-3",
          prompt: finalImagePrompt,
          n: 1,
          size: "1024x1024",
          quality: "hd",
        });

        imageUrl = imageResponse.data?.[0]?.url || null;
      } catch (error: any) {
        console.error('Image generation failed:', error);

        // Log detailed safety violation information
        if (error?.error?.code === 'content_policy_violation') {
          console.error('=== DALL-E SAFETY VIOLATION DETAILS ===');
          console.error('Error message:', error?.error?.message);
          console.error('Error type:', error?.error?.type);
          console.error('Request ID:', error?.request_id);
          console.error('=== PROBLEMATIC PROMPT CONTENT ===');
          console.error('The following prompt was rejected:');
          console.error(finalImagePrompt?.substring(0, 500) + '...');
          console.error('=== END SAFETY DETAILS ===');
        }
        // Image generation failed - log but don't stop the response
      }
    }

    // Send response with judge score if available
    const response: any = {
      success: true,
      petName: name,
      petType: type,
      role,
      explanation: casting,
      imageUrl,
      petDescription  // Include pet description from AI analysis
    };

    if (judgeScore !== null) {
      response.judgeScore = judgeScore;
      response.stars = Math.min(5, Math.max(1, Math.floor(judgeScore / 20)));
    }

    if (judgeComments !== null) {
      response.judgeComments = judgeComments;
    }

    res.json(response);

  } catch (error) {
    res.status(500).json({
      error: 'Failed to generate casting',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Error handling middleware for multer errors
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File too large',
        details: 'Please upload an image smaller than 50MB'
      });
    }
  }
  next(err);
});

// Serve the frontend
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: '🎄 Christmas Critter Casting Call is running!' });
});

// Client config endpoint
app.get('/api/config', (_req, res) => {
  const clientId = process.env.LAUNCHDARKLY_CLIENT_ID;

  if (!clientId) {
    console.warn('⚠️ LAUNCHDARKLY_CLIENT_ID not set in environment variables');
  } else {
    console.log('✅ Serving LaunchDarkly client ID:', clientId.substring(0, 10) + '...');
  }

  res.json({
    clientId: clientId
  });
});

// Test endpoint for LaunchDarkly AI config
app.get('/api/test-ld', async (_req, res) => {
  try {
    console.log('Testing LaunchDarkly AI config with key:', aiConfigKey);

    const defaultValue = {
      enabled: false
    };

    const chat = await aiClient.createChat(aiConfigKey, context, defaultValue, {
      testVariable: 'test'
    });

    console.log('Chat object received:', {
      exists: !!chat,
      hasInvoke: chat && typeof chat.invoke === 'function',
      keys: chat ? Object.keys(chat) : null
    });

    res.json({
      success: true,
      configKey: aiConfigKey,
      chatAvailable: !!chat,
      chatCanInvoke: chat && typeof chat.invoke === 'function',
      message: chat ? 'LaunchDarkly AI is available!' : 'LaunchDarkly AI not configured'
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to test LaunchDarkly',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Test endpoint for vision analysis
app.post('/api/test-vision', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No photo uploaded' });
    }

    // Process image same way as main endpoint
    const pngBuffer = await sharp(req.file.buffer)
      .resize(512, 512, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .png()
      .toBuffer();
    const imageBase64 = pngBuffer.toString('base64');

    console.log('=== VISION TEST ===');
    console.log('Image size:', pngBuffer.length, 'bytes');
    console.log('Base64 length:', imageBase64.length, 'characters');

    // Test direct GPT-4o vision call
    const testResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Describe this pet in detail. Include fur color, eye color, distinctive features, and breed if recognizable. Be very specific about colors.'
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${imageBase64}`
              }
            }
          ]
        }
      ],
      max_tokens: 500
    });

    const description = testResponse.choices[0].message.content;
    console.log('Vision response:', description);
    console.log('=== END VISION TEST ===');

    res.json({
      success: true,
      description,
      imageSize: pngBuffer.length,
      base64Length: imageBase64.length
    });
  } catch (error) {
    console.error('Vision test failed:', error);
    res.status(500).json({
      error: 'Vision test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Test endpoint for image generation
app.get('/api/test-image', async (_req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(400).json({
        error: 'OpenAI API key not configured',
        details: 'Please add OPENAI_API_KEY to your .env file'
      });
    }

    // Start timer
    const startTime = Date.now();

    const testPrompt = `IMPORTANT: This is a wholesome, family-friendly image for a fun pet play. For entertainment purposes only - just adorable pets in costumes!

A cute golden retriever puppy dressed as an Angelic Messenger in a play.
The puppy is wearing golden wings, a halo, and a white flowing robe.
Style: Heartwarming, festive, children's book illustration, colorful and cute.
Set in a magical winter ancient near eastern scene with twinkling lights, snow, and warm festive atmosphere. Whimsical and fun!
Note: This is for a lighthearted, family-friendly pet costume contest - just cute animals in costumes for fun!`;

    const imageResponse = await openai.images.generate({
      model: "dall-e-3",
      prompt: testPrompt,
      n: 1,
      size: "1024x1024",
      quality: "hd",
    });

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000; // Convert to seconds

    const imageUrl = imageResponse.data?.[0]?.url || null;

    res.json({
      success: true,
      imageUrl,
      duration: `${duration.toFixed(2)} seconds`,
      message: imageUrl ? '✅ Image generation is working!' : '❌ Image generation failed',
      testPrompt
    });

  } catch (error) {
    res.status(500).json({
      error: 'Image generation test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Test endpoint for observability verification
app.get('/api/test-observability', (_req, res) => {
  const clientId = process.env.LAUNCHDARKLY_CLIENT_ID;

  res.json({
    success: true,
    clientIdConfigured: !!clientId,
    clientIdPrefix: clientId ? clientId.substring(0, 10) + '...' : 'Not set',
    message: clientId ?
      'Client ID is configured. Check browser console for observability initialization logs.' :
      'Please set LAUNCHDARKLY_CLIENT_ID in your .env file',
    troubleshooting: {
      step1: 'Open browser developer console',
      step2: 'Look for "🚀 Initializing LaunchDarkly" message',
      step3: 'Verify "✅ Observability is now tracking" appears',
      step4: 'Check for any error messages',
      step5: 'Visit LaunchDarkly dashboard > Observability to see sessions'
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🎄 Christmas Critter Casting Call Server 🎄`);
  console.log(`✨ Running at http://localhost:${PORT}`);
  console.log(`\nFeatures enabled:`);
  console.log(`  ✅ LaunchDarkly AI: ${sdkKey ? 'Yes' : 'No'}`);
  console.log(`  ${process.env.OPENAI_API_KEY ? '✅' : '⚠️'} DALL-E 3: ${process.env.OPENAI_API_KEY ? 'Yes' : 'No (add OPENAI_API_KEY)'}`);
  console.log(`  ${process.env.LAUNCHDARKLY_CLIENT_ID ? '✅' : '⚠️'} Observability: ${process.env.LAUNCHDARKLY_CLIENT_ID ? 'Yes' : 'No (add LAUNCHDARKLY_CLIENT_ID)'}`);
  console.log(`\nOpen http://localhost:${PORT} to start casting!\n`);

  if (!process.env.LAUNCHDARKLY_CLIENT_ID) {
    console.log('⚠️  To enable observability, add LAUNCHDARKLY_CLIENT_ID to your .env file');
  }
});