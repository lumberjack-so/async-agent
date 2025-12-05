-- Insert Christmas Present Finder Skill
-- This skill researches a person and finds the perfect Christmas present

INSERT INTO skills (
  id,
  name,
  description,
  trigger_type,
  trigger_config,
  steps,
  connection_names,
  is_system,
  is_active,
  run_count,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'Christmas Present Finder',
  'Research a person deeply and find the perfect Christmas present based on their profile, interests, and motivations. Uses multi-step analysis to understand the person and recommend thoughtful gifts.',
  'manual',
  NULL,
  '[
    {
      "id": 1,
      "prompt": "Research the person whose name is provided in the original request. Use WebSearch extensively to find information about them (social media, professional profiles, articles, interviews, etc.). Create a comprehensive markdown profile document that includes: their background, career, interests, hobbies, values, public statements, and any other relevant information. Save this as a file named \"profile.md\" in the working directory.",
      "guidance": "Be thorough in your research. Search for the person on multiple platforms (LinkedIn, Twitter, GitHub, personal websites, news articles). The more information you gather, the better the final recommendation will be.",
      "allowedTools": ["WebSearch", "Write", "Bash"]
    },
    {
      "id": 2,
      "prompt": "Read the profile.md file you created. Analyze the person''s core motivations, values, and what drives them. Consider their career choices, stated interests, and behavioral patterns. Update the profile.md file by adding a new \"Motivations & Values Analysis\" section that includes: primary motivators, core values, personality insights, and what makes them tick.",
      "guidance": "Think deeply about what the information reveals. Look for patterns in their interests and choices. Consider psychological factors and what truly motivates this person.",
      "allowedTools": ["Read", "Edit", "Write"]
    },
    {
      "id": 3,
      "prompt": "Based on the updated profile.md, research and find the top 5 Christmas present ideas with direct purchase links. For each present, include: product name, direct URL to purchase, price range, why it matches their profile, and a match score (0-100). Use WebSearch to find actual products that can be purchased online. Save the results as \"presents.json\" with this structure: {\"presents\": [{\"rank\": 1, \"name\": \"\", \"url\": \"\", \"price\": \"\", \"reasoning\": \"\", \"matchScore\": 0}]}",
      "guidance": "Search for specific products on Amazon, specialty retailers, or relevant stores. Ensure URLs are direct product links. Be thoughtful about matching presents to their interests and values. The match score should reflect how well the present aligns with their profile.",
      "allowedTools": ["Read", "WebSearch", "Write"]
    },
    {
      "id": 4,
      "prompt": "Read both profile.md and presents.json. Now, assume the persona of the person you researched. Think as they would think, with their values and motivations. From their perspective, which of the 5 presents would THEY most want to receive? Write a brief internal monologue (2-3 paragraphs) explaining which present resonates most and why, speaking in first person as that person. Save this as \"persona_choice.txt\".",
      "guidance": "Truly embody their perspective. Consider not just what they like, but what they value, what would surprise and delight them, what fits their lifestyle and current goals. The choice should feel authentic to who they are.",
      "allowedTools": ["Read", "Write"]
    },
    {
      "id": 5,
      "prompt": "Read persona_choice.txt and presents.json. Based on the persona''s choice, identify which present from the list was selected. Return a clear, well-formatted final recommendation that includes: Selected Present (name), Direct Purchase Link (URL), Price, Why This Is Perfect (2-3 sentences combining the match reasoning and persona insights), and Match Score. Format this as a clean, readable response.",
      "guidance": "Present the final recommendation clearly and confidently. Make it easy for someone to act on this recommendation. The \"why\" should be compelling and specific to the person.",
      "allowedTools": ["Read"]
    }
  ]'::jsonb,
  ARRAY[]::text[],
  false,
  true,
  0,
  NOW(),
  NOW()
);
