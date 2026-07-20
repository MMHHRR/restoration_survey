import { getRandomImages } from './streetImages.js';

// ========================================
// 📚 CITATION
// ========================================
// This survey platform was initially developed for:
// Yang, S., Chong, A., Liu, P., & Biljecki, F. (2025). 
// Thermal comfort in sight: Thermal affordance and its visual assessment for sustainable streetscape design. 
// Building and Environment, 112569. Elsevier.
//
// If you use this platform in your research, please consider citing the above paper.

// ========================================
// 🔧 SURVEY CONFIGURATION GUIDE
// ========================================
// This file defines all survey questions and structure.
// Follow the instructions below to customize your survey.

// ========================================
// 📸 IMAGE GENERATION CONFIGURATION
// ========================================
// This function pre-generates random images for each question to ensure consistency.
// Each participant sees the same set of images throughout their survey session.

const generateQuestionImages = () => {
  const questionImages = {
    // 🔧 PERCEPTION QUESTIONS (Part 2)
    // Format: question_name: getRandomImages("question_name", number_of_images)
    safety_perception: getRandomImages("safety_perception", 2),           // 2 images, choose 1
    attractiveness_perception: getRandomImages("attractiveness_perception", 2), // 2 images, choose 1
    walkability_perception: getRandomImages("walkability_perception", 2),       // 2 images, choose 1
    liveliness_perception: getRandomImages("liveliness_perception", 4),         // 4 images, choose 1
    relaxation_perception: getRandomImages("relaxation_perception", 4),         // 4 images, choose 1
    cleanliness_perception: getRandomImages("cleanliness_perception", 4),       // 4 images, choose 1
    
    // 🔧 OTHER QUESTIONS (Parts 3-6)
    // Each shows 1 random image alongside the question
    comfort_rating: getRandomImages("comfort_rating", 1),     // Part 3: Rating scale
    street_elements: getRandomImages("street_elements", 1),   // Part 4: Checkbox elements
    feature_ranking: getRandomImages("feature_ranking", 1),   // Part 5: Ranking
    open_feedback: getRandomImages("open_feedback", 1)        // Part 6: Text feedback
    
    // 🔧 TO ADD NEW IMAGE QUESTIONS:
    // 1. Add a new line here: your_question_name: getRandomImages("your_question_name", count),
    // 2. Use displayedImages.your_question_name in the question definition below
  };
  
  return questionImages;
};

// Store all displayed images for this survey session
export const displayedImages = generateQuestionImages();

// ========================================
// 👥 DEMOGRAPHIC QUESTIONS (PART 1)
// ========================================
// All demographic questions are OPTIONAL and can be skipped by participants.
// 🔧 TO CUSTOMIZE: Edit the questions below or add/remove questions as needed.

export const demographicQuestions = [
  // 🔧 AGE QUESTION - Multiple choice
  // TO MODIFY: Change age ranges in the choices array
  {
    name: "age",
    title: "What is your age group?",
    type: "radiogroup",
    choices: [
      "Under 18",
      "18-24", 
      "25-34",
      "35-44", 
      "45-54",
      "55-64",
      "65 or older"
    ],
    isRequired: false // Keep false to make optional
  },
  
  // 🔧 LOCATION QUESTION - Text input
  // TO MODIFY: Change the title text or make it more specific
  {
    name: "location",
    title: "Where are you from? (City, Country)",
    type: "text", // Use "text" for single line, "comment" for multi-line
    isRequired: false
  },
  
  // 🔧 INCOME QUESTION - Multiple choice
  // TO MODIFY: Adjust income ranges for your target population/currency
  {
    name: "income",
    title: "What is your household income level?",
    type: "radiogroup", 
    choices: [
      "Under $25,000",
      "$25,000 - $50,000",
      "$50,000 - $75,000", 
      "$75,000 - $100,000",
      "Over $100,000",
      "Prefer not to say"
    ],
    isRequired: false
  },
  
  // 🔧 EDUCATION QUESTION - Multiple choice
  // TO MODIFY: Adjust education levels for your region's system
  {
    name: "education",
    title: "What is your highest level of education?",
    type: "radiogroup",
    choices: [
      "High school or less",
      "Some college",
      "Bachelor's degree", 
      "Master's degree",
      "Doctoral degree",
      "Other"
    ],
    isRequired: false
  },
  
  // 🔧 OUTDOOR ACTIVITY QUESTION - Multiple choice
  // TO MODIFY: Change to any frequency-based question relevant to your research
  {
    name: "outdoor_activity",
    title: "How often do you engage in outdoor activities?",
    type: "radiogroup",
    choices: [
      "Daily",
      "Several times a week",
      "Once a week",
      "Several times a month", 
      "Rarely",
      "Never"
    ],
    isRequired: false
  }
  
  // 🔧 TO ADD NEW DEMOGRAPHIC QUESTIONS:
  // Copy the format above and add new questions here.
  // Remember to add a comma after the previous question!
  
  // Example of adding a new question:
  // {
  //   name: "your_question_name",
  //   title: "Your question text?",
  //   type: "radiogroup", // or "text", "comment", "checkbox"
  //   choices: ["Option 1", "Option 2", "Option 3"], // only for radiogroup/checkbox
  //   isRequired: false
  // }
];

// ========================================
// 📋 MAIN SURVEY STRUCTURE
// ========================================
// The survey is organized into 6 parts (pages). Each page contains multiple questions.
// 🔧 TO CUSTOMIZE: Modify the pages below or add/remove pages as needed.

export const surveyPages = [
  
  // ========================================
  // 📄 PAGE 1: DEMOGRAPHIC QUESTIONS
  // ========================================
  {
    name: "demographics",
    title: "Part 1: Background Information (Optional)", // 🔧 Change page title here
    description: "Please tell us a bit about yourself. All questions are optional and can be skipped.", // 🔧 Change page description
    elements: demographicQuestions // Uses the demographic questions defined above
  },
  
  // ========================================
  // 📄 PAGE 2: STREET PERCEPTION QUESTIONS  
  // ========================================
  // This page contains 6 image-based perception questions
  {
    name: "street_perception", 
    title: "Part 2: Street Perception", // 🔧 Change page title here
    description: "Please evaluate different street environments based on various aspects.", // 🔧 Change page description
    elements: [
      // 🔧 PAGE INSTRUCTIONS - Displayed at the top of the page
      {
        type: "expression",
        name: "perception_instruction",
        title: "In this section, you will see different sets of street images. Please select the image(s) that best match each question.", // 🔧 Change instruction text
        description: "Take your time to examine each image carefully." // 🔧 Change sub-instruction
      },
      
      // 🔧 PERCEPTION QUESTION 1: Safety (2 choose 1)
      // TO MODIFY: Change title, description, or perception type
      {
        type: "imagepicker",
        name: "safety_perception", // 🔧 Must match the name in generateQuestionImages()
        title: "Safety Perception", // 🔧 Change question title
        description: "Which street environment do you perceive to be the SAFEST?", // 🔧 Change question description
        isRequired: true, // 🔧 Set to false to make optional
        choices: displayedImages.safety_perception, // Uses pre-generated images
        imageFit: "cover", // Keep as "cover" for best display
        multiSelect: false // Keep false for "choose 1", true for "choose multiple"
      },
      
      // 🔧 PERCEPTION QUESTION 2: Attractiveness (2 choose 1)
      // TO MODIFY: Replace "attractiveness" with your own perception (e.g., "beauty", "appeal")
      {
        type: "imagepicker",
        name: "attractiveness_perception", // 🔧 Change name and update in generateQuestionImages()
        title: "Visual Attractiveness", // 🔧 Change question title
        description: "Which street environment do you find most VISUALLY ATTRACTIVE?", // 🔧 Change question description
        isRequired: true,
        choices: displayedImages.attractiveness_perception,
        imageFit: "cover",
        multiSelect: false
      },
      
      // 🔧 PERCEPTION QUESTION 3: Walkability (2 choose 1)
      {
        type: "imagepicker", 
        name: "walkability_perception", // 🔧 Change name and update in generateQuestionImages()
        title: "Walkability", // 🔧 Change question title
        description: "Which street environment would be most COMFORTABLE for walking?", // 🔧 Change question description
        isRequired: true,
        choices: displayedImages.walkability_perception,
        imageFit: "cover",
        multiSelect: false
      },
      
      // 🔧 PERCEPTION QUESTION 4: Liveliness (4 choose 1)
      {
        type: "imagepicker",
        name: "liveliness_perception", // 🔧 Change name and update in generateQuestionImages()
        title: "Liveliness and Vitality", // 🔧 Change question title
        description: "Which street environment appears most LIVELY and full of activity?", // 🔧 Change question description
        isRequired: true,
        choices: displayedImages.liveliness_perception,
        imageFit: "cover",
        multiSelect: false
      },
      
      // 🔧 PERCEPTION QUESTION 5: Relaxation (4 choose 1)
      {
        type: "imagepicker",
        name: "relaxation_perception", // 🔧 Change name and update in generateQuestionImages()
        title: "Relaxation and Tranquility", // 🔧 Change question title
        description: "Which street environment seems most RELAXING and peaceful?", // 🔧 Change question description
        isRequired: true,
        choices: displayedImages.relaxation_perception,
        imageFit: "cover",
        multiSelect: false
      },
      
      // 🔧 PERCEPTION QUESTION 6: Cleanliness (4 choose 1)
      {
        type: "imagepicker",
        name: "cleanliness_perception", // 🔧 Change name and update in generateQuestionImages()
        title: "Cleanliness and Maintenance", // 🔧 Change question title
        description: "Which street environment appears most CLEAN and well-maintained?", // 🔧 Change question description
        isRequired: true,
        choices: displayedImages.cleanliness_perception,
        imageFit: "cover",
        multiSelect: false
      }
      
      // 🔧 TO ADD NEW PERCEPTION QUESTIONS:
      // 1. Add the question name to generateQuestionImages() at the top
      // 2. Copy one of the questions above and modify the name, title, and description
      // 3. Don't forget the comma after the previous question!
    ]
  },
  
  // ========================================
  // 📄 PAGE 3: LIKERT SCALE RATING
  // ========================================
  // Shows 1 image with a rating scale question
  {
    name: "comfort_rating",
    title: "Part 3: Comfort Rating", // 🔧 Change page title
    description: "Please rate how comfortable you would feel in this street environment.", // 🔧 Change page description
    elements: [
      // 🔧 IMAGE DISPLAY - Shows 1 random image
      {
        type: "image",
        name: "comfort_image",
        imageLink: displayedImages.comfort_rating[0]?.imageLink, // Uses pre-generated image
        imageFit: "cover", // Keep as "cover"
        imageHeight: "300px", // 🔧 Adjust image height
        imageWidth: "100%" // Keep as "100%"
      },
      // 🔧 RATING QUESTION - 1-5 scale
      {
        type: "radiogroup", // Keep as "radiogroup" for rating scale
        name: "comfort_level", // 🔧 Change question name
        title: "How comfortable would you feel walking in this street?", // 🔧 Change question text
        isRequired: true, // 🔧 Set to false to make optional
        choices: [
          { value: 1, text: "Very Uncomfortable" }, // 🔧 Change scale labels
          { value: 2, text: "Uncomfortable" },
          { value: 3, text: "Neutral" },
          { value: 4, text: "Comfortable" },
          { value: 5, text: "Very Comfortable" }
          // 🔧 TO ADD MORE SCALE POINTS: Add more choices with value 6, 7, etc.
        ]
      }
    ]
  },
  
  // ========================================
  // 📄 PAGE 4: CHECKBOX QUESTIONS (Select Multiple)
  // ========================================
  // Shows 1 image with checkbox options for element identification
  {
    name: "street_elements",
    title: "Part 4: Street Elements", // 🔧 Change page title
    description: "Identify the elements you notice in this street environment.", // 🔧 Change page description
    elements: [
      // 🔧 IMAGE DISPLAY - Shows 1 random image
      {
        type: "image", 
        name: "elements_image",
        imageLink: displayedImages.street_elements[0]?.imageLink, // Uses pre-generated image
        imageFit: "cover",
        imageHeight: "300px", // 🔧 Adjust image height
        imageWidth: "100%"
      },
      // 🔧 CHECKBOX QUESTION - Select multiple options
      {
        type: "checkbox", // Keep as "checkbox" for multiple selection
        name: "visible_elements", // 🔧 Change question name
        title: "Which elements do you notice in this street? (Select all that apply)", // 🔧 Change question text
        isRequired: true, // 🔧 Set to false to make optional
        choices: [
          // 🔧 MODIFY THESE OPTIONS - Add/remove/change street elements
          "Trees and vegetation",
          "Street furniture (benches, lights)",
          "Bicycle lanes", 
          "Pedestrian crossings",
          "Public art or decorations",
          "Commercial buildings",
          "Residential buildings",
          "Parking spaces",
          "Public transportation stops",
          "Outdoor dining areas"
          // 🔧 TO ADD MORE OPTIONS: Add more strings to this array
        ]
      }
    ]
  },
  
  // ========================================
  // 📄 PAGE 5: RANKING QUESTIONS (Drag & Drop)
  // ========================================
  // Shows 1 image with drag-and-drop ranking question
  {
    name: "feature_ranking",
    title: "Part 5: Feature Importance Ranking", // 🔧 Change page title
    description: "Look at this street environment and rank the features by importance for creating a pleasant walking experience.", // 🔧 Change page description
    elements: [
      // 🔧 IMAGE DISPLAY - Shows 1 random image
      {
        type: "image", 
        name: "ranking_image",
        imageLink: displayedImages.feature_ranking[0]?.imageLink, // Uses pre-generated image
        imageFit: "cover",
        imageHeight: "300px", // 🔧 Adjust image height
        imageWidth: "100%"
      },
      // 🔧 RANKING QUESTION - Drag and drop to reorder
      {
        type: "ranking", // Keep as "ranking" for drag-and-drop functionality
        name: "street_features", // 🔧 Change question name
        title: "Based on the image above, drag to rank these features from most important (top) to least important (bottom):", // 🔧 Change question text
        isRequired: true, // 🔧 Set to false to make optional
        choices: [
          // 🔧 MODIFY THESE RANKING OPTIONS - Each needs "value" and "text"
          { value: "safety", text: "Safety and security" },
          { value: "greenery", text: "Trees and greenery" },
          { value: "walkability", text: "Wide sidewalks and walkability" },
          { value: "aesthetics", text: "Visual appeal and aesthetics" },
          { value: "amenities", text: "Street furniture and amenities" }
          // 🔧 TO ADD MORE OPTIONS: Add more objects with value and text properties
        ]
      }
    ]
  },
  
  // ========================================
  // 📄 PAGE 6: TEXT INPUT QUESTIONS (Open-ended)
  // ========================================
  // Shows 1 image with open-ended text response
  {
    name: "open_feedback",
    title: "Part 6: Your Thoughts", // 🔧 Change page title
    description: "Finally, share your thoughts about what makes a great street environment.", // 🔧 Change page description
    elements: [
      // 🔧 IMAGE DISPLAY - Shows 1 random image
      {
        type: "image", 
        name: "feedback_image",
        imageLink: displayedImages.open_feedback[0]?.imageLink, // Uses pre-generated image
        imageFit: "cover",
        imageHeight: "300px", // 🔧 Adjust image height
        imageWidth: "100%"
      },
      // 🔧 TEXT INPUT QUESTION - Open-ended response
      {
        type: "comment", // Use "comment" for multi-line text, "text" for single line
        name: "general_feedback", // 🔧 Change question name
        title: "Looking at this street, what makes a street environment appealing to you? (Optional)", // 🔧 Change question text
        description: "Please share your thoughts about streetscape design, walkability, or any other aspects that matter to you.", // 🔧 Change question description
        isRequired: false, // 🔧 Set to true to make required
        maxLength: 500 // 🔧 Adjust character limit (or remove for unlimited)
      }
    ]
  }
];

// ========================================
// 🔧 SURVEY CONFIGURATION
// ========================================
// Main survey settings and structure

export const surveyJson = {
  // 🔧 SURVEY TITLE AND DESCRIPTION
  title: "Urban Streetscape Perception Survey", // 🔧 Change main survey title
  description: "This survey helps us understand how people perceive different street environments. Your responses will help improve urban design.", // 🔧 Change survey description
  
  // 🔧 SURVEY STRUCTURE
  pages: surveyPages, // Uses the pages defined above
  
  // 🔧 DISPLAY SETTINGS - Customize survey appearance
  showQuestionNumbers: "off", // "on", "off", or "onPage" - Show question numbers
  showProgressBar: "aboveheader", // "top", "bottom", "aboveheader", "belowheader", or "off"
  progressBarType: "questions", // "pages" or "questions" - Progress calculation method
  autoGrowComment: true, // Auto-expand text areas as user types
  showPreviewBeforeComplete: "showAllQuestions" // "showAllQuestions", "showAnsweredQuestions", or "noPreview"
  
  // 🔧 ADDITIONAL SETTINGS YOU CAN ADD:
  // completedHtml: "<h3>Thank you for your participation!</h3>", // Custom completion message
  // requiredText: "*", // Symbol for required questions
  // questionErrorLocation: "bottom", // "top" or "bottom" - Where to show validation errors
  // showCompletedPage: false, // Skip the completion page
}; 