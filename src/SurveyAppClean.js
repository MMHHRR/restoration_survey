import React, { useState, useEffect } from "react";
import { Model } from "survey-core";
import { Survey } from "survey-react-ui";
import "survey-core/defaultV2.min.css";
import { Box, Alert, CircularProgress, Typography } from '@mui/material';
import { saveSurveyResponse } from './lib/supabase';
import { deploymentConfig, getPreloadedImages } from './config/deploymentConfig';
import { generateCustomTheme } from './lib/surveyStorage';
import registerImageRankingWidget, { registerImageRatingWidget, registerImageBooleanWidget, registerImageMatrixWidget } from './components/SurveyCustomComponents';

export default function SurveyAppClean() {
  const [surveyModel, setSurveyModel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    initializeSurvey();
  }, []);

  const initializeSurvey = async () => {
    try {
      setLoading(true);
      console.log('Starting survey initialization...');
      const imageTracker = {};
      const globallyUsedImageKeys = new Set();
      const getImageKey = (image) => image?.name || image?.url;
      const shouldExcludePreviouslyUsedImages = (element) => element.excludePreviouslyUsedImages !== false;
      const pickRandomImagesFromPool = (pool, imageCount, excludeUsed) => {
        const shuffled = [...pool].sort(() => 0.5 - Math.random());
        if (!excludeUsed) {
          return shuffled.slice(0, imageCount);
        }
        const filtered = shuffled.filter((image) => {
          const key = getImageKey(image);
          return key && !globallyUsedImageKeys.has(key);
        });
        return filtered.slice(0, imageCount);
      };
      const trackGloballyUsedImages = (selectedImages, excludeUsed) => {
        if (!excludeUsed) return;
        selectedImages.forEach((image) => {
          const key = getImageKey(image);
          if (key) globallyUsedImageKeys.add(key);
        });
      };
      
      // Register custom components
      registerImageRankingWidget();
      registerImageRatingWidget();
      registerImageBooleanWidget();
      registerImageMatrixWidget();
      console.log('Custom widgets registered');
      
      // Deep clone deployment configuration to avoid mutations
      const surveyConfig = JSON.parse(JSON.stringify(deploymentConfig));
      
      if (!surveyConfig) {
        throw new Error('Deployment configuration not found');
      }
      
      if (!surveyConfig.pages || surveyConfig.pages.length === 0) {
        throw new Error('No pages found in survey configuration');
      }
      
      console.log(`Survey config loaded: ${surveyConfig.pages.length} pages`);

      // Process preloaded images if available
      const preloadedImages = getPreloadedImages();
      
      if (preloadedImages && preloadedImages.length > 0) {
        console.log(`Using ${preloadedImages.length} preloaded images from deployment`);
        
        // Replace image URLs in survey config with preloaded ones
        if (surveyConfig.pages) {
          for (const page of surveyConfig.pages) {
            if (page.elements) {
              for (const element of page.elements) {
                // Handle different image question types
                if (element.randomImageSelection && preloadedImages.length > 0) {
                  // Use type-specific defaults if imageCount is not set
                  const defaultCount = (element.type === 'imagerating' || element.type === 'imagematrix' || element.type === 'imageboolean' || element.type === 'image') ? 1 : 4;
                  const imageCount = element.imageCount || defaultCount;
                  const excludeUsed = shouldExcludePreviouslyUsedImages(element);
                  const selectedImages = pickRandomImagesFromPool(preloadedImages, imageCount, excludeUsed);
                  trackGloballyUsedImages(selectedImages, excludeUsed);
                  
                  if (element.type === 'image') {
                    element.imageLink = selectedImages[0].url;
                    element.imageName = selectedImages[0].name || selectedImages[0].url;
                  } else if (element.type === 'imageboolean' || element.type === 'imagerating' || element.type === 'imagematrix') {
                    // For imageboolean, imagerating, and imagematrix questions, store imageHtml
                    let imagesHtml = '<div style="display: flex; flex-wrap: wrap; gap: 10px; margin: 10px 0;">';
                    selectedImages.forEach((image) => {
                      imagesHtml += `<img src="${image.url}" style="max-width: 300px; height: auto; border-radius: 4px;" />`;
                    });
                    imagesHtml += '</div>';
                    
                    element.imageHtml = imagesHtml;
                    element.imageNames = selectedImages.map((img) => img.name || img.url);
                  } else {
                    element.choices = selectedImages.map((image, index) => ({
                      value: `image_${index}`,
                      imageLink: image.url,
                      imageName: image.name || image.url
                    }));
                    element.imageNames = selectedImages.map((img) => img.name || img.url);
                  }
                  imageTracker[element.name] = selectedImages.map((img) => img.name || img.url);
                  element.imageFit = "cover";
                }
              }
            }
          }
        }
      } else {
        console.warn('No preloaded images available');
      }
      
      // Post-process: Convert imageboolean questions to panels with HTML + boolean
      if (surveyConfig.pages) {
        for (const page of surveyConfig.pages) {
          if (page.elements) {
            const newElements = [];
            for (const element of page.elements) {
              if (element.type === 'imageboolean' && element.imageHtml) {
                // Convert imageboolean to panel - keeps everything in one frame
                console.log(`Deployment: Converting imageboolean question ${element.name} to panel with HTML`);
                
                newElements.push({
                  type: 'panel',
                  name: `${element.name}_panel`,
                  title: 'See below images:', // Fixed instruction text
                  description: element.description,
                  state: 'expanded',
                  elements: [
                    {
                      type: 'html',
                      name: `${element.name}_images`,
                      html: element.imageHtml
                    },
                    {
                      type: 'boolean',
                      name: element.name,
                      title: element.title, // Show actual question title
                      isRequired: element.isRequired,
                      labelTrue: element.labelTrue || 'Yes',
                      labelFalse: element.labelFalse || 'No',
                      valueTrue: element.valueTrue,
                      valueFalse: element.valueFalse
                    }
                  ]
                });
              } else if (element.type === 'imagerating' && element.imageHtml) {
                // Convert imagerating to panel - keeps everything in one frame
                console.log(`Deployment: Converting imagerating question ${element.name} to panel with HTML`);
                
                newElements.push({
                  type: 'panel',
                  name: `${element.name}_panel`,
                  title: 'See below images:', // Fixed instruction text
                  description: element.description,
                  state: 'expanded',
                  elements: [
                    {
                      type: 'html',
                      name: `${element.name}_images`,
                      html: element.imageHtml
                    },
                    {
                      type: 'rating',
                      name: element.name,
                      title: element.title, // Show actual question title
                      isRequired: element.isRequired,
                      rateMin: element.rateMin || 1,
                      rateMax: element.rateMax || 5,
                      minRateDescription: element.minRateDescription,
                      maxRateDescription: element.maxRateDescription
                    }
                  ]
                });
              } else if (element.type === 'imagematrix' && element.imageHtml) {
                // Convert imagematrix to panel - keeps everything in one frame
                console.log(`Deployment: Converting imagematrix question ${element.name} to panel with HTML`);
                
                newElements.push({
                  type: 'panel',
                  name: `${element.name}_panel`,
                  title: 'See below images:', // Fixed instruction text
                  description: element.description,
                  state: 'expanded',
                  elements: [
                    {
                      type: 'html',
                      name: `${element.name}_images`,
                      html: element.imageHtml
                    },
                    {
                      type: 'matrix',
                      name: element.name,
                      title: element.title, // Show actual question title
                      isRequired: element.isRequired,
                      columns: element.columns,
                      rows: element.rows
                    }
                  ]
                });
              } else {
                newElements.push(element);
              }
            }
            page.elements = newElements;
          }
        }
      }

      // Create survey model
      console.log('Creating survey model...');
      const model = new Model(surveyConfig);
      console.log('Survey model created successfully');
      
      // Apply theme
      if (surveyConfig.theme) {
        const customTheme = generateCustomTheme(surveyConfig);
        if (customTheme) {
          model.applyTheme(customTheme);
        }
      }
      
      // Apply survey configuration
      model.title = surveyConfig.title || '';
      model.description = surveyConfig.description || '';
      model.logo = surveyConfig.logo || '';
      model.logoPosition = surveyConfig.logoPosition || 'right';

      // Handle survey completion
      model.onComplete.add(async (survey, options) => {
        const responses = survey.data;
        const mapImageChoiceAnswerToNames = (answerValue, shownImages) => {
          if (!shownImages || shownImages.length === 0) return answerValue;
          const mapSingleValue = (value) => {
            if (typeof value !== 'string') return value;
            const match = value.match(/^image_(\d+)$/);
            if (!match) return value;
            const imageIndex = parseInt(match[1], 10);
            return shownImages[imageIndex] || value;
          };
          if (Array.isArray(answerValue)) return answerValue.map(mapSingleValue);
          return mapSingleValue(answerValue);
        };
        const surveyQuestionTypeMap = {};
        survey.getAllQuestions().forEach((question) => {
          surveyQuestionTypeMap[question.name] = question.getType();
        });
        const enrichedResponses = Object.entries(responses).reduce((acc, [questionName, answerValue]) => {
          const shownImages = imageTracker[questionName] || [];
          acc[questionName] = {
            type: surveyQuestionTypeMap[questionName] || null,
            answer: mapImageChoiceAnswerToNames(answerValue, shownImages),
            shown_images: shownImages
          };
          return acc;
        }, {});
        
        const completeData = {
          responses: enrichedResponses,
          raw_responses: responses,
          displayed_images: imageTracker,
          survey_metadata: {
            completion_time: new Date().toISOString(),
            user_agent: navigator.userAgent,
            screen_resolution: `${window.screen.width}x${window.screen.height}`,
            survey_version: deploymentConfig.name || 'deployment',
            project_id: deploymentConfig.id || 'unknown'
          }
        };
        
        console.log("Survey completed:", completeData);
        
        // Save to Supabase
        const result = await saveSurveyResponse(completeData);
        
        if (result.success) {
          const storageMessage = result.storage === 'supabase'
            ? "Thank you for completing the survey! Your responses have been saved to the database."
            : "Thank you for completing the survey! Your responses have been saved locally.";
          alert(storageMessage);
        } else {
          console.error("Failed to save survey response:", result.error);
          const errorMessage = result?.error?.message || result?.error || 'Unknown error';
          alert(`There was an error saving your responses: ${errorMessage}`);
        }
      });

      setSurveyModel(model);
      setError(null);
    } catch (err) {
      console.error('Error initializing survey:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', gap: 2 }}>
        <CircularProgress />
        <Typography variant="body2" color="text.secondary">Loading survey...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3, maxWidth: 800, mx: 'auto', mt: 4 }}>
        <Alert severity="error">
          <strong>Error loading survey:</strong><br/>
          {error}
          <br/><br/>
          Please check the browser console (F12) for more details.
        </Alert>
      </Box>
    );
  }

  if (!surveyModel) {
    return (
      <Box sx={{ p: 3, maxWidth: 800, mx: 'auto', mt: 4 }}>
        <Alert severity="warning">
          Survey model not initialized. Please refresh the page.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', px: 2, py: 3 }}>
      <Survey model={surveyModel} />
    </Box>
  );
}
