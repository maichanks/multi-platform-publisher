/**
 * Xiaohongshu (Little Red Book) Browser Automation Selectors
 * Provides multiple selector strategies with fallbacks for robust element identification
 */

/**
 * Base selector interface with multiple fallback strategies
 */
export interface SelectorStrategy {
  /** Primary CSS selector */
  css?: string;
  /** XPath selector */
  xpath?: string;
  /** Text content-based selector (button text, placeholder, etc.) */
  text?: string;
  /** Role-based selector (aria-role, data-role) */
  role?: string;
  /** Test ID or data attribute */
  testId?: string;
  /** Class-based (partial match) */
  className?: string;
  /** Custom evaluation function */
  custom?: (page: any) => Promise<any>;
  /** Timeout in ms for this strategy (default: 30000) */
  timeout?: number;
}

/**
 * Element configuration with multiple fallback strategies
 */
export interface ElementConfig {
  /** Element description for logging */
  description: string;
  /** List of selector strategies to try in order */
  strategies: SelectorStrategy[];
  /** Whether element is required (throws if not found) */
  required?: boolean;
  /** Wait for element to be visible/attached/hidden */
  waitFor?: 'visible' | 'attached' | 'hidden' | 'enabled';
  /** Alternative element locator for dynamic content */
  alternatives?: ElementConfig[];
}

/**
 * Page-specific selector collections
 */
export interface PageSelectors {
  /** Login page selectors */
  login: {
    /** QR code container or image */
    qrCode: ElementConfig;
    /** Phone number input field */
    phoneInput: ElementConfig;
    /** Country code selector (optional) */
    countryCodeSelector?: ElementConfig;
    /** Verification code input field */
    verificationCodeInput: ElementConfig;
    /** Get verification code button */
    getVerificationCodeBtn: ElementConfig;
    /** Login/submit button */
    loginBtn: ElementConfig;
    /** Switch to phone login (if on QR page) */
    switchToPhoneLogin: ElementConfig;
    /** Error message container */
    errorMessage: ElementConfig;
    /** Success indicator */
    successIndicator?: ElementConfig;
  };
  /** Post creation page selectors */
  createPost: {
    /** Page container to verify we're on create post page */
    pageContainer: ElementConfig;
    /** Title input field */
    titleInput: ElementConfig;
    /** Content textarea (main body) */
    contentTextarea: ElementConfig;
    /** Image upload button/area */
    imageUpload: ElementConfig;
    /** Image preview area (for verification) */
    imagePreview: ElementConfig;
    /** Tag input field */
    tagInput: ElementConfig;
    /** Suggested tags container */
    suggestedTags: ElementConfig;
    /** Add tag button */
    addTagBtn: ElementConfig;
    /** Location/topic selector */
    locationSelector: ElementConfig;
    /** Privacy/visibility selector */
    privacySelector: ElementConfig;
    /** Submit/publish button */
    submitBtn: ElementConfig;
    /** Draft save button */
    saveDraftBtn: ElementConfig;
    /** Cancel button */
    cancelBtn: ElementConfig;
    /** Character counter */
    charCounter: ElementConfig;
    /** Validation error message */
    validationError: ElementConfig;
    /** Success modal after publishing */
    successModal: ElementConfig;
  };
  /** General selectors (shared across pages) */
  common: {
    /** Cookie consent banner */
    cookieBanner: ElementConfig;
    /** Close button for modals */
    closeModalBtn: ElementConfig;
    /** Loading spinner */
    loadingSpinner: ElementConfig;
    /** Network error toast */
    networkErrorToast: ElementConfig;
  };
}

/**
 * Xiaohongshu Selectors Configuration
 * Provides multiple fallback strategies for each element to handle UI changes
 */
export const xhsSelectors: PageSelectors = {
  /**
   ========================
   * LOGIN PAGE SELECTORS
   * ========================
   */
  login: {
    /**
     * QR Code Element
     * Strategy: Try data-testid, then img with alt containing "QR", then svg/canvas
     */
    qrCode: {
      description: 'QR code for login scanning',
      required: true,
      waitFor: 'visible',
      strategies: [
        { testId: 'login-qr-code' },
        { testId: 'qr-code' },
        { css: 'img[alt*="QR"]' },
        { css: 'img[src*="qr"]' },
        { css: 'canvas' },
        { css: '[class*="QRCode"], [class*="QrCode"], [class*="qrCode"]' },
        { xpath: '//img[contains(@alt, "QR") or contains(@src, "qr")]' },
        { xpath: '//canvas' },
        {
          custom: async (page) => {
            // Try to find the main QR code area by heuristics
            return page.evaluateHandle(() => {
              const elements = Array.from(document.querySelectorAll('img, canvas, div'));
              return elements.find(el => {
                const alt = el.getAttribute('alt') || '';
                const src = el.getAttribute('src') || '';
                const className = el.className || '';
                return (alt.toLowerCase().includes('qr') || 
                        src.toLowerCase().includes('qr') || 
                        className.toLowerCase().includes('qr'));
              });
            });
          }
        }
      ]
    },

    /**
     * Phone Number Input
     * Strategy: Try various input types, placeholders, and labels
     */
    phoneInput: {
      description: 'Phone number input field',
      required: true,
      waitFor: 'visible',
      strategies: [
        { testId: 'phone-input' },
        { testId: 'mobile-input' },
        { css: 'input[type="tel"]' },
        { css: 'input[placeholder*="phone"]' },
        { css: 'input[placeholder*="mobile"]' },
        { css: 'input[placeholder*="手机"]' },
        { css: 'input[placeholder*="电话"]' },
        { css: 'input[name*="phone"]' },
        { css: 'input[name*="mobile"]' },
        { css: 'input[id*="phone"]' },
        { css: 'input.id*="mobile"]' },
        { xpath: '//input[@type="tel"]' },
        { xpath: '//input[contains(@placeholder, "phone") or contains(@placeholder, "mobile") or contains(@placeholder, "手机")]' },
        {
          custom: async (page) => {
            // Find input by associated label
            return page.evaluateHandle(() => {
              const inputs = Array.from(document.querySelectorAll('input'));
              return inputs.find(input => {
                const placeholder = input.placeholder || '';
                const name = input.name || '';
                const id = input.id || '';
                const ariaLabel = input.getAttribute('aria-label') || '';
                return placeholder.match(/phone|mobile|手机|电话/i) ||
                       name.match(/phone|mobile/i) ||
                       id.match(/phone|mobile/i) ||
                       ariaLabel.match(/phone|mobile/i);
              });
            });
          }
        }
      ]
    },

    /**
     * Country Code Selector (optional)
     * Used to select country code before phone number
     */
    countryCodeSelector: {
      description: 'Country code dropdown selector',
      required: false,
      waitFor: 'visible',
      strategies: [
        { testId: 'country-code-selector' },
        { css: '[class*="CountryCode"], [class*="countryCode"]' },
        { css: 'select[name*="country"]' },
        { css: 'div[role="combobox"]' },
        { xpath: '//div[contains(@class, "country")]//input | //select[contains(@name, "country")]' },
        {
          custom: async (page) => {
            return page.evaluateHandle(() => {
              const selectors = [
                '[class*="country"]',
                '[class*="Country"]',
                'select',
                'div[role="combobox"]'
              ];
              for (const selector of selectors) {
                const el = document.querySelector(selector);
                if (el) return el;
              }
              return null;
            });
          }
        }
      ]
    },

    /**
     * Verification Code Input
     */
    verificationCodeInput: {
      description: 'SMS verification code input',
      required: true,
      waitFor: 'visible',
      strategies: [
        { testId: 'verification-code-input' },
        { testId: 'code-input' },
        { css: 'input[placeholder*="code"]' },
        { css: 'input[placeholder*="验证"]' },
        { css: 'input[placeholder*="验证码"]' },
        { css: 'input[name*="code"]' },
        { css: 'input[name*="verification"]' },
        { css: 'input[id*="code"]' },
        { css: '[class*="CodeInput"], [class*="codeInput"]' },
        { css: 'input[type="text"][maxlength="6"]' },
        { xpath: '//input[contains(@placeholder, "验证码") or contains(@placeholder, "code")]' },
        {
          custom: async (page) => {
            return page.evaluateHandle(() => {
              const inputs = Array.from(document.querySelectorAll('input'));
              return inputs.find(input => {
                const placeholder = input.placeholder || '';
                const maxLength = input.getAttribute('maxlength');
                return (placeholder.match(/验证码|code|验证/i) && 
                        (maxLength === '4' || maxLength === '6' || maxLength === '8')) ||
                       (input.type === 'text' && (maxLength === '4' || maxLength === '6'));
              });
            });
          }
        }
      ]
    },

    /**
     * Get Verification Code Button
     */
    getVerificationCodeBtn: {
      description: 'Button to request SMS verification code',
      required: true,
      waitFor: 'visible',
      strategies: [
        { testId: 'get-code-btn' },
        { testId: 'send-code-btn' },
        { css: 'button[type="button"]' },
        { css: 'button:has-text("验证码")' },
        { css: 'button:has-text("获取验证码")' },
        { css: 'button:has-text("发送验证码")' },
        { css: 'button:has-text("Get Code")' },
        { css: 'button:has-text("Send Code")' },
        { xpath: '//button[contains(text(), "验证码") or contains(text(), "获取") or contains(text(), "发送")]' },
        { xpath: '//button[contains(text(), "Get Code") or contains(text(), "Send Code")]' },
        {
          custom: async (page) => {
            return page.evaluateHandle(() => {
              const buttons = Array.from(document.querySelectorAll('button'));
              return buttons.find(btn => {
                const text = btn.textContent || '';
                return /(获取|发送|发送验证码|验证码|Get Code|Send Code)/i.test(text.trim());
              });
            });
          }
        }
      ]
    },

    /**
     * Login/Submit Button
     */
    loginBtn: {
      description: 'Login or submit button',
      required: true,
      waitFor: 'visible',
      strategies: [
        { testId: 'login-btn' },
        { testId: 'submit-btn' },
        { testId: 'sign-in-btn' },
        { css: 'button[type="submit"]' },
        { css: 'button.login-btn' },
        { css: 'button.submit-btn' },
        { css: 'button:has-text("登录")' },
        { css: 'button:has-text("登录/注册")' },
        { css: 'button:has-text("Sign In")' },
        { css: 'button:has-text("Login")' },
        { css: 'button:has-text("Submit")' },
        { xpath: '//button[contains(text(), "登录") or contains(text(), "登录/注册")]' },
        { xpath: '//button[contains(text(), "Sign In") or contains(text(), "Login") or contains(text(), "Submit")]' },
        {
          custom: async (page) => {
            return page.evaluateHandle(() => {
              const buttons = Array.from(document.querySelectorAll('button'));
              return buttons.find(btn => {
                const text = btn.textContent || '';
                const isLogin = /(登录|login|sign in|submit)/i.test(text.trim());
                const isVisible = btn.offsetParent !== null;
                return isLogin && isVisible;
              });
            });
          }
        }
      ]
    },

    /**
     * Switch to Phone Login (when on QR code page)
     */
    switchToPhoneLogin: {
      description: 'Switch from QR code to phone login',
      required: false,
      waitFor: 'visible',
      strategies: [
        { testId: 'switch-phone-login' },
        { css: 'a[href*="login"]' },
        { css: 'a:has-text("手机登录")' },
        { css: 'a:has-text("验证码登录")' },
        { css: 'button:has-text("手机号登录")' },
        { xpath: '//a[contains(text(), "手机") or contains(text(), "手机号")]' },
        {
          custom: async (page) => {
            return page.evaluateHandle(() => {
              const elements = Array.from(document.querySelectorAll('a, button, span'));
              return elements.find(el => {
                const text = el.textContent || '';
                return /(手机|验证码|phone|sms)/i.test(text.trim());
              });
            });
          }
        }
      ]
    },

    /**
     * Error Message Display
     */
    errorMessage: {
      description: 'Error message display',
      required: false,
      waitFor: 'visible',
      strategies: [
        { testId: 'error-message' },
        { css: '[class*="Error"], [class*="error"]' },
        { css: '.error-message' },
        { css: '.error-msg' },
        { css: '[role="alert"]' },
        { css: '[class*="toast"], [class*="Toast"]' },
        { xpath: '//div[contains(@class, "error")]' },
        {
          custom: async (page) => {
            return page.evaluateHandle(() => {
              const errors = Array.from(document.querySelectorAll('[role="alert"], .error, .error-message, [class*="error"]'));
              return errors.find(el => el.textContent && el.textContent.trim().length > 0);
            });
          }
        }
      ]
    },

    /**
     * Success Indicator (after login)
     */
    successIndicator: {
      description: 'Indicator that login was successful',
      required: false,
      waitFor: 'visible',
      strategies: [
        { testId: 'login-success' },
        { css: '[class*="success"], [class*="Success"]' },
        { css: '[class*="welcome"]' },
        { xpath: '//div[contains(text(), "登录成功") or contains(text(), "欢迎")]' },
      ]
    }
  },

  /**
   * ========================
   * POST CREATION PAGE SELECTORS
   * ========================
   */
  createPost: {
    /**
     * Page Container
     * Used to verify we're on the correct page
     */
    pageContainer: {
      description: 'Create post page container',
      required: true,
      waitFor: 'visible',
      strategies: [
        { testId: 'create-post-page' },
        { css: '[class*="Publish"], [class*="publish"]' },
        { css: '[class*="Create"], [class*="create"]' },
        { css: '[class*="Editor"], [class*="editor"]' },
        { xpath: '//div[contains(@class, "publish") or contains(@class, "create") or contains(@class, "edit")]' },
      ]
    },

    /**
     * Title Input Field
     */
    titleInput: {
      description: 'Post title input field',
      required: true,
      waitFor: 'visible',
      strategies: [
        { testId: 'post-title-input' },
        { testId: 'title-input' },
        { css: 'input[placeholder*="title"]' },
        { css: 'input[placeholder*="标题"]' },
        { css: 'input[name*="title"]' },
        { css: '[class*="TitleInput"], [class*="titleInput"]' },
        { xpath: '//input[contains(@placeholder, "标题") or contains(@name, "title")]' },
        {
          custom: async (page) => {
            return page.evaluateHandle(() => {
              const inputs = Array.from(document.querySelectorAll('input, textarea'));
              return inputs.find(input => {
                const placeholder = input.placeholder || '';
                const maxLength = input.getAttribute('maxlength');
                return (placeholder.match(/标题|title/i) && maxLength) ||
                       (input.tagName === 'INPUT' && maxLength >= 20);
              });
            });
          }
        }
      ]
    },

    /**
     * Content Textarea (Main Body)
     */
    contentTextarea: {
      description: 'Main content textarea',
      required: true,
      waitFor: 'visible',
      strategies: [
        { testId: 'post-content' },
        { testId: 'content-textarea' },
        { css: 'textarea' },
        { css: 'textarea[placeholder*="content"]' },
        { css: 'textarea[placeholder*="内容"]' },
        { css: 'div[contenteditable="true"]' },
        { css: '[class*="Content"], [class*="content"]' },
        { css: '[class*="Textarea"], [class*="textarea"]' },
        { xpath: '//textarea | //div[@contenteditable="true"]' },
        {
          custom: async (page) => {
            return page.evaluateHandle(() => {
              const textareas = Array.from(document.querySelectorAll('textarea, div[contenteditable="true"]'));
              return textareas.find(area => {
                const placeholder = area.placeholder || '';
                const isContentious = placeholder.match(/内容|content|正文/i);
                return isContentious || (area.tagName === 'TEXTAREA' && area.rows > 3);
              });
            });
          }
        }
      ]
    },

    /**
     * Image Upload Button/Area
     */
    imageUpload: {
      description: 'Image upload button or area',
      required: false, // Posts may not have images
      waitFor: 'visible',
      strategies: [
        { testId: 'image-upload' },
        { testId: 'upload-image-btn' },
        { css: 'input[type="file"][accept*="image"]' },
        { css: 'input[type="file"]' },
        { css: 'button:has-text("添加图片")' },
        { css: 'button:has-text("上传图片")' },
        { css: 'button:has-text("图片")' },
        { css: '[class*="Upload"], [class*="upload"]' },
        { css: '[class*="Image"], [class*="image"]' },
        { css: '[class*="Pic"], [class*="pic"]' },
        { xpath: '//button[contains(text(), "图片") or contains(text(), "上传")]' },
        {
          custom: async (page) => {
            return page.evaluateHandle(() => {
              const fileInputs = Array.from(document.querySelectorAll('input[type="file"]'));
              if (fileInputs.length > 0) return fileInputs[0];
              
              const buttons = Array.from(document.querySelectorAll('button, div[role="button"]'));
              return buttons.find(btn => {
                const text = btn.textContent || '';
                return /(添加图片|上传图片|图片|photo|image)/i.test(text.trim());
              });
            });
          }
        }
      ]
    },

    /**
     * Image Preview Area
     * Used to verify images were uploaded successfully
     */
    imagePreview: {
      description: 'Image preview container',
      required: false,
      waitFor: 'visible',
      strategies: [
        { testId: 'image-preview' },
        { testId: 'preview-area' },
        { css: '[class*="Preview"], [class*="preview"]' },
        { css: '[class*="ImageList"], [class*="imageList"]' },
        { css: 'ul[class*="image"] > li, div[class*="image"] > div' },
        { css: 'img.preview-image, img.image-preview' },
        { xpath: '//div[contains(@class, "preview")]//img | //ul[contains(@class, "image")]//img' },
      ]
    },

    /**
     * Tag Input Field
     */
    tagInput: {
      description: 'Tag input field',
      required: false,
      waitFor: 'visible',
      strategies: [
        { testId: 'tag-input' },
        { css: 'input[placeholder*="tag"]' },
        { css: 'input[placeholder*="标签"]' },
        { css: 'input[name*="tag"]' },
        { css: '[class*="TagInput"], [class*="tagInput"]' },
        { xpath: '//input[contains(@placeholder, "标签") or contains(@name, "tag")]' },
        {
          custom: async (page) => {
            return page.evaluateHandle(() => {
              const inputs = Array.from(document.querySelectorAll('input'));
              return inputs.find(input => {
                const placeholder = input.placeholder || '';
                return /(标签|tag)/i.test(placeholder);
              });
            });
          }
        }
      ]
    },

    /**
     * Suggested Tags Container
     * Shows available/hot tags to select
     */
    suggestedTags: {
      description: 'Suggested tags container',
      required: false,
      waitFor: 'visible',
      strategies: [
        { testId: 'suggested-tags' },
        { css: '[class*="TagList"], [class*="tagList"]' },
        { css: '[class*="Suggested"], [class*="suggested"]' },
        { css: 'div[class*="tag"]' },
        { xpath: '//div[contains(@class, "tag") and contains(@class, "list")]' },
      ]
    },

    /**
     * Add Tag Button
     * Used to add a tag from suggestions
     */
    addTagBtn: {
      description: 'Add tag button',
      required: false,
      waitFor: 'visible',
      strategies: [
        { testId: 'add-tag-btn' },
        { css: 'button:has-text("添加")' },
        { css: 'button:has-text("添加标签")' },
        { css: 'button:has-text("确认")' },
        { xpath: '//button[contains(text(), "添加") or contains(text(), "确认")]' },
      ]
    },

    /**
     * Location/Topic Selector
     */
    locationSelector: {
      description: 'Location or topic selector',
      required: false,
      waitFor: 'visible',
      strategies: [
        { testId: 'location-selector' },
        { css: '[class*="Location"], [class*="location"]' },
        { css: '[class*="Topic"], [class*="topic"]' },
        { css: 'div[role="combobox"]' },
        { xpath: '//div[contains(@class, "location") or contains(@class, "topic")]' },
      ]
    },

    /**
     * Privacy/Visibility Selector
     */
    privacySelector: {
      description: 'Post privacy/visibility selector',
      required: false,
      waitFor: 'visible',
      strategies: [
        { testId: 'privacy-selector' },
        { css: '[class*="Privacy"], [class*="privacy"]' },
        { css: '[class*="Visible"], [class*="visible"]' },
        { css: 'div[role="combobox"]' },
        { xpath: '//div[contains(@class, "privacy") or contains(@class, "visible")]' },
      ]
    },

    /**
     * Submit/Publish Button
     */
    submitBtn: {
      description: 'Publish/Submit button',
      required: true,
      waitFor: 'visible',
      strategies: [
        { testId: 'publish-btn' },
        { testId: 'submit-post-btn' },
        { css: 'button[type="submit"]' },
        { css: 'button.publish-btn' },
        { css: 'button.submit-btn' },
        { css: 'button:has-text("发布")' },
        { css: 'button:has-text("发布笔记")' },
        { css: 'button:has-text("发布笔记")' },
        { css: 'button:has-text("Publish")' },
        { css: 'button:has-text("Submit")' },
        { xpath: '//button[contains(text(), "发布") or contains(text(), "发布笔记")]' },
        { xpath: '//button[contains(text(), "Publish") or contains(text(), "Submit")]' },
        {
          custom: async (page) => {
            return page.evaluateHandle(() => {
              const buttons = Array.from(document.querySelectorAll('button'));
              return buttons.find(btn => {
                const text = btn.textContent || '';
                const isPublish = /(发布|发布笔记|publish|submit)/i.test(text.trim());
                const isPrimary = btn.classList.contains('primary') || 
                                  btn.style.cssText.includes('primary') ||
                                  btn.getAttribute('data-type') === 'primary';
                return isPublish && isPrimary;
              });
            });
          }
        }
      ]
    },

    /**
     * Save Draft Button
     */
    saveDraftBtn: {
      description: 'Save as draft button',
      required: false,
      waitFor: 'visible',
      strategies: [
        { testId: 'save-draft-btn' },
        { css: 'button:has-text("保存草稿")' },
        { css: 'button:has-text("存草稿")' },
        { css: 'button:has-text("Save Draft")' },
        { xpath: '//button[contains(text(), "草稿") or contains(text(), "Draft")]' },
      ]
    },

    /**
     * Cancel Button
     */
    cancelBtn: {
      description: 'Cancel button',
      required: false,
      waitFor: 'visible',
      strategies: [
        { testId: 'cancel-btn' },
        { css: 'button:has-text("取消")' },
        { css: 'button:has-text("Cancel")' },
        { css: 'a:has-text("取消")' },
        { xpath: '//button[contains(text(), "取消") or contains(text(), "Cancel")]' },
      ]
    },

    /**
     * Character Counter
     */
    charCounter: {
      description: 'Character count display',
      required: false,
      waitFor: 'visible',
      strategies: [
        { testId: 'char-counter' },
        { css: '[class*="Counter"], [class*="counter"]' },
        { css: '[class*="Limit"], [class*="limit"]' },
        { css: 'span:has-text("/")' }, // Pattern: "100/1000"
        { xpath: '//span[contains(text(), "/")]' },
      ]
    },

    /**
     * Validation Error Message
     */
    validationError: {
      description: 'Form validation error message',
      required: false,
      waitFor: 'visible',
      strategies: [
        { testId: 'validation-error' },
        { css: '[class*="Validation"], [class*="validation"]' },
        { css: '.error-message' },
        { css: '[role="alert"]' },
        { xpath: '//div[contains(@class, "error")]' },
      ]
    },

    /**
     * Success Modal (after publishing)
     */
    successModal: {
      description: 'Success confirmation modal',
      required: false,
      waitFor: 'visible',
      strategies: [
        { testId: 'success-modal' },
        { testId: 'publish-success' },
        { css: '[class*="Success"], [class*="success"]' },
        { css: '[class*="Toast"], [class*="toast"]' },
        { xpath: '//div[contains(text(), "发布成功") or contains(text(), "成功")]' },
      ]
    }
  },

  /**
   * ========================
   * COMMON SELECTORS (Shared)
   * ========================
   */
  common: {
    /**
     * Cookie Consent Banner
     */
    cookieBanner: {
      description: 'Cookie consent notification',
      required: false,
      waitFor: 'visible',
      strategies: [
        { testId: 'cookie-banner' },
        { css: '[id*="cookie"]' },
        { css: '[class*="cookie"]' },
        { css: '[id*="consent"]' },
        { css: '[class*="consent"]' },
        { xpath: '//div[contains(@class, "cookie") or contains(@class, "consent")]' },
      ]
    },

    /**
     * Close Modal Button
     * Generic close button for popups/modals
     */
    closeModalBtn: {
      description: 'Close button for modals',
      required: false,
      waitFor: 'visible',
      strategies: [
        { testId: 'close-modal' },
        { css: 'button[aria-label="Close"]' },
        { css: 'button.close' },
        { css: '.close-btn' },
        { css: 'svg[data-icon="close"]' },
        { css: '[class*="Close"], [class*="close"]' },
        { xpath: '//button[@aria-label="Close"] | //button[contains(@class, "close")]' },
      ]
    },

    /**
     * Loading Spinner
     */
    loadingSpinner: {
      description: 'Loading indicator',
      required: false,
      waitFor: 'visible',
      strategies: [
        { testId: 'loading-spinner' },
        { css: '.loading' },
        { css: '.spinner' },
        { css: '[class*="spin"]' },
        { css: 'svg[class*="loading"]' },
        { xpath: '//div[contains(@class, "loading") or contains(@class, "spin")]' },
      ]
    },

    /**
     * Network Error Toast
     */
    networkErrorToast: {
      description: 'Network error notification',
      required: false,
      waitFor: 'visible',
      strategies: [
        { testId: 'network-error' },
        { css: '[class*="Error"], [class*="error"]' },
        { css: '[class*="Toast"], [class*="toast"]' },
        { css: '[role="alert"]' },
        { xpath: '//div[contains(text(), "网络") and contains(text(), "错误")]' },
        { xpath: '//div[contains(text(), "Network") and contains(text(), "Error")]' },
      ]
    }
  }
};

/**
 * Utility function to find element using multiple strategies
 * Tries each strategy in order until element is found or all fail
 */
export async function findElementWithFallbacks(
  page: any,
  config: ElementConfig,
  logger?: any
): Promise<any> {
  const errors: string[] = [];

  for (let i = 0; i < config.strategies.length; i++) {
    const strategy = config.strategies[i];
    const timeout = strategy.timeout || 30000;

    try {
      let element:

      // Try CSS selector
      if (strategy.css) {
        element = await page.waitForSelector(strategy.css, { timeout, visible: config.waitFor === 'visible' }).catch(() => null);
        if (element) {
          logger?.debug(`Found element "${config.description}" using CSS: ${strategy.css}`);
          return element;
        }
      }

      // Try XPath selector
      if (strategy.xpath) {
        element = await page.waitForXPath(strategy.xpath, { timeout, visible: config.waitFor === 'visible' }).catch(() => null);
        if (element) {
          logger?.debug(`Found element "${config.description}" using XPath: ${strategy.xpath}`);
          return element;
        }
      }

      // Try text-based selector (using page.$eval with text content)
      if (strategy.text) {
        element = await page.waitForFunction(
          (text) => {
            const elements = Array.from(document.querySelectorAll('*'));
            return elements.find(el => el.textContent?.trim() === text);
          },
          { timeout, value: strategy.text }
        ).catch(() => null);
        if (element) {
          logger?.debug(`Found element "${config.description}" using text: ${strategy.text}`);
          return element;
        }
      }

      // Try role-based selector
      if (strategy.role) {
        element = await page.waitForSelector(`[role="${strategy.role}"]`, { timeout, visible: config.waitFor === 'visible' }).catch(() => null);
        if (element) {
          logger?.debug(`Found element "${config.description}" using role: ${strategy.role}`);
          return element;
        }
      }

      // Try test ID selector
      if (strategy.testId) {
        element = await page.waitForSelector(`[data-testid="${strategy.testId}"]`, { timeout, visible: config.waitFor === 'visible' }).catch(() => null);
        if (element) {
          logger?.debug(`Found element "${config.description}" using testId: ${strategy.testId}`);
          return element;
        }
        // Also try data-test attribute
        element = await page.waitForSelector(`[data-test="${strategy.testId}"]`, { timeout, visible: config.waitFor === 'visible' }).catch(() => null);
        if (element) {
          logger?.debug(`Found element "${config.description}" using data-test: ${strategy.testId}`);
          return element;
        }
      }

      // Try class name (partial match)
      if (strategy.className) {
        element = await page.waitForSelector(`[class*="${strategy.className}"]`, { timeout, visible: config.waitFor === 'visible' }).catch(() => null);
        if (element) {
          logger?.debug(`Found element "${config.description}" using className: ${strategy.className}`);
          return element;
        }
      }

      // Try custom function
      if (strategy.custom) {
        element = await strategy.custom(page);
        if (element) {
          logger?.debug(`Found element "${config.description}" using custom strategy ${i + 1}`);
          return element;
        }
      }

      errors.push(`Strategy ${i + 1} failed`);
    } catch (error: any) {
      errors.push(`Strategy ${i + 1}: ${error.message}`);
      // Continue to next strategy
    }
  }

  // Element not found after all strategies
  const errorMessage = `Failed to find element: ${config.description}. Tried ${config.strategies.length} strategies. Errors: ${errors.join('; ')}`;
  
  if (config.required) {
    throw new Error(errorMessage);
  }

  logger?.warn(errorMessage);
  return null;
}

/**
 * Utility to wait for page load with fallbacks
 */
export async function waitForPageLoad(
  page: any,
  selectors: PageSelectors,
  pageType: 'login' | 'createPost',
  logger?: any,
  maxWaitTime: number = 60000
): Promise<boolean> {
  const startTime = Date.now();
  const pageConfig = pageType === 'login' ? selectors.login : selectors.createPost;
  
  // Try page container first as indicator
  try {
    if (pageConfig.pageContainer) {
      await findElementWithFallbacks(page, pageConfig.pageContainer, logger);
      logger?.info(`Page type "${pageType}" detected successfully`);
      return true;
    }
  } catch (e) {
    // Continue to try alternative indicators
  }

  // If no page container, try key elements
  const keyElements = Object.values(pageConfig).filter((cfg): cfg is ElementConfig => 
    cfg.description !== 'Page container' && cfg.required
  );

  let foundCount = 0;
  while (Date.now() - startTime < maxWaitTime) {
    for (const elementConfig of keyElements) {
      try {
        await findElementWithFallbacks(page, elementConfig, logger);
        foundCount++;
      } catch {
        // Not found yet
      }
    }

    if (foundCount >= Math.min(2, keyElements.length)) {
      logger?.info(`Page type "${pageType}" ready (found ${foundCount} key elements)`);
      return true;
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  logger?.error(`Page type "${pageType}" not ready after ${maxWaitTime}ms`);
  return false;
}

// Export type guards
export function isElementConfig(obj: any): obj is ElementConfig {
  return obj && typeof obj === 'object' && 'description' in obj && 'strategies' in obj;
}

export function isPageSelectors(obj: any): obj is PageSelectors {
  return obj && typeof obj === 'object' && 'login' in obj && 'createPost' in obj;
}
