import React, { useState, useEffect, useRef } from "react";
import { Model } from "survey-core";
import { Survey } from "survey-react-ui";
import "survey-core/defaultV2.min.css";
import { Box, Alert, CircularProgress, Typography, Snackbar } from '@mui/material';
import { saveSurveyResponse } from './lib/supabase';
import { deploymentConfig, getPreloadedImages } from './config/deploymentConfig';
import { generateCustomTheme } from './lib/surveyStorage';
import {
  hasLocalStorage,
  normalizeUserId,
  saveDraft,
  loadDraft,
  clearDraft,
  savePending,
  listPending,
  clearPending,
} from './lib/surveyDraft';
import registerImageRankingWidget, { registerImageRatingWidget, registerImageBooleanWidget, registerImageMatrixWidget } from './components/SurveyCustomComponents';

export default function SurveyAppClean() {
  const [surveyModel, setSurveyModel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  // 图片分配表与跨题去重集合提升为 ref：
  // 恢复草稿时要能从外部改写它们，而 onComplete 依赖同一个对象引用
  const imageTrackerRef = useRef({});
  const globallyUsedImageKeysRef = useRef(new Set());
  const userIdRef = useRef('');
  const restoreHandledRef = useRef(false);
  const draftTimerRef = useRef(null);
  const flushLockRef = useRef(false);

  useEffect(() => {
    initializeSurvey();
  }, []);

  const initializeSurvey = async () => {
    try {
      setLoading(true);
      console.log('Starting survey initialization...');
      const imageTracker = imageTrackerRef.current;
      const globallyUsedImageKeys = globallyUsedImageKeysRef.current;
      // 重复初始化（React StrictMode 会双调用）时先清空，避免残留上一次的分配
      Object.keys(imageTracker).forEach((key) => delete imageTracker[key]);
      globallyUsedImageKeys.clear();
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

      // 关闭提交前的预览页：所有题目均为必填，答完直接提交即可。
      // 放在这里而不是只改 deploymentConfig，是为了避免重新生成的配置把它覆盖回去。
      surveyConfig.showPreviewBeforeComplete = 'noPreview';

      // 参与者 ID 必填：它既是草稿恢复的 key，也是入库时的幂等键，
      // 留空会导致刷新后无法恢复、以及同一人产生多条记录。
      surveyConfig.pages.forEach((page) => {
        (page.elements || []).forEach((element) => {
          if (element.name === 'user_id') {
            element.isRequired = true;
            element.validators = [
              {
                type: 'regex',
                regex: '^[A-Za-z0-9_-]{2,20}$',
                text: '請輸入有效的參與者 ID（2-20 位字母、數字、- 或 _）。'
              }
            ];
          }
          // 矩阵题统一必填（配置里 R1/R5 漏设为 false）；
          // 注意 SurveyJS 的 isRequired 对矩阵只要求“至少填一格”，
          // “4 行全答”由下面的 onValidateQuestion 兜底。
          if (element.type === 'matrix') {
            element.isRequired = true;
          }
        });
      });
      
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

      const INTRO_PAGE_NAME = 'page_intro';

      // 矩阵题要求所有评分项都完成。
      // SurveyJS 对矩阵题的 isRequired 只保证“至少一格有值”，
      // 仅靠它会出现“4 行只答 1 行也能过页”的数据缺失。
      model.onValidateQuestion.add((survey, options) => {
        const question = options.question;
        if (!question || question.getType() !== 'matrix') return;
        const value = question.value || {};
        const rows = question.rows || [];
        const missing = rows.filter(
          (row) => value[row.value] === undefined || value[row.value] === null || value[row.value] === ''
        );
        if (missing.length > 0) {
          options.error = '請完成本題所有評分項目（尚有 ' + missing.length + ' 項未作答）。';
          // SurveyJS 会把整个矩阵题标红，且一直持续到答完。
          // 这里让高亮几秒后自动淡出；校验强度不变（再点 Next 仍会重新报错并拦住）。
          if (question.__matrixErrorTimer) clearTimeout(question.__matrixErrorTimer);
          question.__matrixErrorTimer = setTimeout(() => {
            if (typeof question.clearErrors === 'function') {
              question.clearErrors();
            }
          }, 3000);
        }
      });

      // ---- 用草稿重建图片分配（必须与保存时完全一致）----
      // 只恢复答案而不恢复图片分配，会让 image_N 与 shown_images 错位
      const applyDraftSnapshot = (survey, draft) => {
        const preloaded = getPreloadedImages() || [];
        const urlByName = new Map();
        preloaded.forEach((image) => {
          if (image && image.name) urlByName.set(image.name, image.url);
        });

        const tracker = draft.imageTracker || {};
        const usedNames = new Set();
        survey.getAllQuestions().forEach((question) => {
          const names = tracker[question.name];
          if (!names || names.length === 0) return;
          const type = question.getType();
          if (type === 'imagepicker') {
            question.choices = names.map((name, index) => ({
              value: 'image_' + index,
              imageLink: urlByName.get(name) || name,
              imageName: name
            }));
          } else if (type === 'image') {
            question.imageLink = urlByName.get(names[0]) || names[0];
          }
          names.forEach((name) => usedNames.add(name));
        });

        // 原地替换，保持对象引用不变（onComplete 闭包持有同一个 imageTracker）
        Object.keys(imageTracker).forEach((key) => delete imageTracker[key]);
        Object.assign(imageTracker, tracker);
        globallyUsedImageKeys.clear();
        usedNames.forEach((name) => globallyUsedImageKeys.add(name));

        if (draft.data) survey.data = draft.data;
        if (draft.uiState) {
          try {
            survey.uiState = draft.uiState;
          } catch (e) {
            console.warn('Failed to restore uiState:', e);
          }
        }
      };

      const tryRestoreFromDraft = (survey, userId, draft) => {
        // 检测到该 ID 的草稿就直接续答，不做弹窗打断
        applyDraftSnapshot(survey, draft);
        if (typeof draft.currentPageNo === 'number') {
          survey.currentPageNo = draft.currentPageNo;
        }
        setToast({
          severity: 'info',
          message: '已恢復上次的作答進度（ID：' + userId + '）。'
        });
        return true;
      };

      // ---- 草稿保存（节流 400ms）----
      const scheduleSaveDraft = (survey) => {
        if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
        draftTimerRef.current = setTimeout(() => {
          const userId = userIdRef.current;
          if (!userId) return;
          let uiState;
          try {
            uiState = survey.uiState;
          } catch (e) {
            uiState = undefined;
          }
          saveDraft(userId, {
            currentPageNo: survey.currentPageNo,
            data: survey.data,
            imageTracker,
            uiState
          });
        }, 400);
      };

      // 参与者 ID 只在第一页填写，因此“恢复”只能发生在离开第一页时
      model.onCurrentPageChanged.add((survey, options) => {
        const leavingIntro = options.oldCurrentPage && options.oldCurrentPage.name === INTRO_PAGE_NAME;
        if (leavingIntro && !restoreHandledRef.current) {
          restoreHandledRef.current = true;
          const userId = normalizeUserId(survey.getValue('user_id'));
          if (userId) {
            userIdRef.current = userId;
            // 把归一化后的 ID 写回问卷，保证入库内容与 key 一致
            survey.setValue('user_id', userId);
            const draft = loadDraft(userId);
            if (draft) {
              tryRestoreFromDraft(survey, userId, draft);
            }
          }
        }
        scheduleSaveDraft(survey);
      });

      model.onValueChanged.add((survey) => {
        scheduleSaveDraft(survey);
      });

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
        
        // 参与者 ID：优先取问卷中的值，其次用本会话记录的值
        const userId = normalizeUserId(survey.getValue('user_id')) || userIdRef.current;

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
        const result = await saveSurveyResponse(completeData, userId);
        
        if (result.success) {
          if (userId) clearDraft(userId);
          setToast({
            severity: 'success',
            message: result.storage === 'supabase'
              ? '提交成功，感謝您的參與！'
              : '提交成功（已儲存到本機檔案）。'
          });
        } else {
          console.error('Failed to save survey response:', result.error);
          if (userId) {
            // 已答完但没交上：草稿已无意义，转为待补交队列
            clearDraft(userId);
            savePending(userId, completeData);
            const errorCode = result?.error?.code ? '（错误码 ' + result.error.code + '）' : '';
            setToast({
              severity: 'warning',
              message: !hasLocalStorage
                ? '提交失敗，且當前瀏覽器無法暫存於本機，請聯絡研究人員。'
                : result.errorType === 'server'
                  ? '提交被伺服器拒絕' + errorCode + '。您的作答已暫存在本機，請聯絡研究人員處理。'
                  : '網路異常：您的作答已暫存在本機，網路恢復後會自動提交。請勿清除瀏覽器資料或更換裝置。'
            });
          } else {
            const errorMessage = result?.error?.message || result?.error || 'Unknown error';
            setToast({ severity: 'error', message: '提交失敗：' + errorMessage });
          }
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

  // ---- 断网补交：进入页面 / 网络恢复 / 每分钟 各尝试一次 ----
  const flushPending = async () => {
    // StrictMode 下 useEffect 会双调用，加锁避免并发重复提交
    if (flushLockRef.current) return;
    flushLockRef.current = true;
    try {
      const pendingList = listPending();
      if (pendingList.length === 0) return;
      console.log('[surveyDraft] 发现 ' + pendingList.length + ' 条待补交记录，尝试提交...');
      for (const item of pendingList) {
        try {
          const result = await saveSurveyResponse(item.payload, item.userId);
          if (result.success) {
            clearPending(item.userId);
            console.log('[surveyDraft] 补交成功:', item.userId);
            setToast({ severity: 'success', message: '已自動補交上次未提交的作答，感謝您的參與！' });
          } else {
            console.warn('[surveyDraft] 补交失败:', item.userId, result.error);
          }
        } catch (e) {
          console.warn('[surveyDraft] 补交异常:', item.userId, e);
        }
      }
    } finally {
      flushLockRef.current = false;
    }
  };

  useEffect(() => {
    flushPending();
    const handleOnline = () => flushPending();
    window.addEventListener('online', handleOnline);
    const timer = setInterval(flushPending, 60000);
    return () => {
      window.removeEventListener('online', handleOnline);
      clearInterval(timer);
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      <Snackbar
        open={!!toast}
        autoHideDuration={toast && toast.severity === 'warning' ? 15000 : 6000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          variant="filled"
          severity={(toast && toast.severity) || 'info'}
          onClose={() => setToast(null)}
          sx={{ maxWidth: 640 }}
        >
          {toast ? toast.message : ''}
        </Alert>
      </Snackbar>
    </Box>
  );
}
