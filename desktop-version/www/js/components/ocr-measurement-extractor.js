/**
 * OCR-Based Measurement Extractor for DICOM Images
 *
 * Uses Tesseract.js to extract burned-in text measurements from ultrasound
 * and other medical images where measurements are overlaid on the pixel data.
 *
 * References:
 * - Tesseract.js: https://tesseract.projectnaptha.com/
 * - Image preprocessing: https://tesseract-ocr.github.io/tessdoc/ImproveQuality.html
 * - Medical image OCR research: https://ceur-ws.org/Vol-3792/paper12.pdf
 */

(function() {
    'use strict';

    // Ensure namespace exists
    window.DICOM_VIEWER = window.DICOM_VIEWER || {};

    class OCRMeasurementExtractor {
        constructor() {
            this.worker = null;
            this.isInitialized = false;
            this.isProcessing = false;

            // Measurement patterns to look for in OCR text
            this.measurementPatterns = {
                // Obstetric measurements
                bpd: /\b(?:BPD|B\.P\.D)\s*[:\-=]?\s*(\d+\.?\d*)\s*(mm|cm)?/gi,
                hc: /\b(?:HC|H\.C)\s*[:\-=]?\s*(\d+\.?\d*)\s*(mm|cm)?/gi,
                ac: /\b(?:AC|A\.C)\s*[:\-=]?\s*(\d+\.?\d*)\s*(mm|cm)?/gi,
                fl: /\b(?:FL|F\.L)\s*[:\-=]?\s*(\d+\.?\d*)\s*(mm|cm)?/gi,
                crl: /\b(?:CRL|C\.R\.L)\s*[:\-=]?\s*(\d+\.?\d*)\s*(mm|cm)?/gi,
                efw: /\b(?:EFW|E\.F\.W|Est\.?\s*Fetal\s*Weight)\s*[:\-=]?\s*(\d+\.?\d*)\s*(g|kg|gm)?/gi,
                ga: /\b(?:GA|G\.A|Gest\.?\s*Age)\s*[:\-=]?\s*(\d+)\s*[wW]\s*(\d+)?\s*[dD]?/gi,
                afi: /\b(?:AFI|A\.F\.I)\s*[:\-=]?\s*(\d+\.?\d*)\s*(cm)?/gi,

                // Abdominal organ measurements
                liver: /\b(?:Liver|LIVER|Liv)\s*[:\-=]?\s*(\d+\.?\d*)\s*(cm|mm)?/gi,
                spleen: /\b(?:Spleen|SPLEEN|Spl)\s*[:\-=]?\s*(\d+\.?\d*)\s*(cm|mm)?/gi,
                kidney: /\b(?:Kidney|KIDNEY|Kid|RK|LK|R\.K|L\.K)\s*[:\-=]?\s*(\d+\.?\d*)\s*[x×X]\s*(\d+\.?\d*)(?:\s*[x×X]\s*(\d+\.?\d*))?\s*(cm|mm)?/gi,
                cbd: /\b(?:CBD|C\.B\.D|Common\s*Bile\s*Duct)\s*[:\-=]?\s*(\d+\.?\d*)\s*(mm|cm)?/gi,
                aorta: /\b(?:Aorta|AORTA|Ao)\s*[:\-=]?\s*(\d+\.?\d*)\s*(cm|mm)?/gi,
                gbWall: /\b(?:GB\s*Wall|Gallbladder\s*Wall)\s*[:\-=]?\s*(\d+\.?\d*)\s*(mm)?/gi,

                // Thyroid measurements
                thyroidRight: /\b(?:Right\s*Lobe|R\.?\s*Lobe|RT\s*Lobe)\s*[:\-=]?\s*(\d+\.?\d*)\s*[x×X]\s*(\d+\.?\d*)\s*[x×X]\s*(\d+\.?\d*)\s*(cm|mm)?/gi,
                thyroidLeft: /\b(?:Left\s*Lobe|L\.?\s*Lobe|LT\s*Lobe)\s*[:\-=]?\s*(\d+\.?\d*)\s*[x×X]\s*(\d+\.?\d*)\s*[x×X]\s*(\d+\.?\d*)\s*(cm|mm)?/gi,
                isthmus: /\b(?:Isthmus|ISTHMUS|Isth)\s*[:\-=]?\s*(\d+\.?\d*)\s*(mm|cm)?/gi,

                // Pelvic measurements
                uterus: /\b(?:Uterus|UTERUS|Ut)\s*[:\-=]?\s*(\d+\.?\d*)\s*[x×X]\s*(\d+\.?\d*)\s*[x×X]\s*(\d+\.?\d*)\s*(cm|mm)?/gi,
                endometrium: /\b(?:Endometrium|ET|Endo)\s*[:\-=]?\s*(\d+\.?\d*)\s*(mm)?/gi,
                ovary: /\b(?:Ovary|R\.?\s*Ovary|L\.?\s*Ovary|RO|LO)\s*[:\-=]?\s*(\d+\.?\d*)\s*[x×X]\s*(\d+\.?\d*)(?:\s*[x×X]\s*(\d+\.?\d*))?\s*(cm|mm)?/gi,

                // Vascular measurements
                psv: /\b(?:PSV|P\.S\.V|Peak\s*Systolic)\s*[:\-=]?\s*(\d+\.?\d*)\s*(cm\/s|m\/s)?/gi,
                edv: /\b(?:EDV|E\.D\.V|End\s*Diastolic)\s*[:\-=]?\s*(\d+\.?\d*)\s*(cm\/s|m\/s)?/gi,
                ri: /\b(?:RI|R\.I|Resistive\s*Index)\s*[:\-=]?\s*(\d+\.?\d*)/gi,
                pi: /\b(?:PI|P\.I|Pulsatility\s*Index)\s*[:\-=]?\s*(\d+\.?\d*)/gi,

                // Generic dimension patterns (catches L x W x H formats)
                dimensions: /(\d+\.?\d*)\s*[x×X]\s*(\d+\.?\d*)(?:\s*[x×X]\s*(\d+\.?\d*))?\s*(cm|mm)/gi,

                // Generic measurement with unit
                generic: /(\d+\.?\d*)\s*(cm|mm|ml|cc|g|kg|cm\/s|m\/s|%)/gi
            };

            // Category mapping
            this.categoryMap = {
                bpd: 'obstetric', hc: 'obstetric', ac: 'obstetric', fl: 'obstetric',
                crl: 'obstetric', efw: 'obstetric', ga: 'obstetric', afi: 'obstetric',
                liver: 'abdominal', spleen: 'abdominal', kidney: 'abdominal',
                cbd: 'abdominal', aorta: 'abdominal', gbWall: 'abdominal',
                thyroidRight: 'thyroid', thyroidLeft: 'thyroid', isthmus: 'thyroid',
                uterus: 'pelvic', endometrium: 'pelvic', ovary: 'pelvic',
                psv: 'vascular', edv: 'vascular', ri: 'vascular', pi: 'vascular'
            };

            // Human-readable names
            this.measurementNames = {
                bpd: 'Biparietal Diameter (BPD)',
                hc: 'Head Circumference (HC)',
                ac: 'Abdominal Circumference (AC)',
                fl: 'Femur Length (FL)',
                crl: 'Crown Rump Length (CRL)',
                efw: 'Estimated Fetal Weight',
                ga: 'Gestational Age',
                afi: 'Amniotic Fluid Index',
                liver: 'Liver',
                spleen: 'Spleen',
                kidney: 'Kidney',
                cbd: 'Common Bile Duct',
                aorta: 'Aorta',
                gbWall: 'GB Wall Thickness',
                thyroidRight: 'Right Thyroid Lobe',
                thyroidLeft: 'Left Thyroid Lobe',
                isthmus: 'Thyroid Isthmus',
                uterus: 'Uterus',
                endometrium: 'Endometrial Thickness',
                ovary: 'Ovary',
                psv: 'Peak Systolic Velocity',
                edv: 'End Diastolic Velocity',
                ri: 'Resistive Index',
                pi: 'Pulsatility Index'
            };
        }

        /**
         * Initialize Tesseract worker
         */
        async initialize() {
            if (this.isInitialized) return true;

            try {
                console.log('Initializing OCR engine...');

                // Load Tesseract.js from CDN if not already loaded
                if (typeof Tesseract === 'undefined') {
                    await this.loadTesseractScript();
                }

                // Create worker
                this.worker = await Tesseract.createWorker('eng', 1, {
                    logger: m => {
                        if (m.status === 'recognizing text') {
                            const progress = Math.round(m.progress * 100);
                            this.updateProgress(progress);
                        }
                    }
                });

                // Set recognition parameters for better accuracy on medical images
                await this.worker.setParameters({
                    tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.:×xX-=/ ',
                    tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT, // Good for scattered text
                    preserve_interword_spaces: '1'
                });

                this.isInitialized = true;
                console.log('✓ OCR engine initialized');
                return true;

            } catch (error) {
                console.error('Failed to initialize OCR:', error);
                return false;
            }
        }

        /**
         * Load Tesseract.js script dynamically
         */
        loadTesseractScript() {
            return new Promise((resolve, reject) => {
                if (typeof Tesseract !== 'undefined') {
                    resolve();
                    return;
                }

                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
                script.onload = () => {
                    console.log('✓ Tesseract.js loaded');
                    resolve();
                };
                script.onerror = () => reject(new Error('Failed to load Tesseract.js'));
                document.head.appendChild(script);
            });
        }

        /**
         * Update progress indicator
         */
        updateProgress(progress) {
            const progressEl = document.getElementById('ocr-progress');
            if (progressEl) {
                progressEl.style.width = `${progress}%`;
                progressEl.textContent = `${progress}%`;
            }
        }

        /**
         * Extract measurements from a viewport canvas
         */
        async extractFromViewport(viewportElement) {
            if (this.isProcessing) {
                console.warn('OCR already in progress');
                return null;
            }

            this.isProcessing = true;

            try {
                // Initialize if needed
                if (!this.isInitialized) {
                    const initialized = await this.initialize();
                    if (!initialized) {
                        throw new Error('Failed to initialize OCR engine');
                    }
                }

                // Get the cornerstone canvas
                const canvas = viewportElement.querySelector('canvas');
                if (!canvas) {
                    throw new Error('No canvas found in viewport');
                }

                // Preprocess the image for better OCR
                const processedCanvas = await this.preprocessImage(canvas);

                // Run OCR
                console.log('Running OCR on preprocessed image...');
                const result = await this.worker.recognize(processedCanvas);

                // Parse the OCR text for measurements
                const measurements = this.parseOCRText(result.data.text);

                console.log('OCR complete. Found', measurements.length, 'measurements');
                console.log('Raw OCR text:', result.data.text);

                return {
                    success: true,
                    measurements,
                    rawText: result.data.text,
                    confidence: result.data.confidence
                };

            } catch (error) {
                console.error('OCR extraction failed:', error);
                return {
                    success: false,
                    error: error.message,
                    measurements: []
                };
            } finally {
                this.isProcessing = false;
            }
        }

        /**
         * Extract from image URL or base64
         */
        async extractFromImage(imageSource) {
            if (this.isProcessing) {
                return null;
            }

            this.isProcessing = true;

            try {
                if (!this.isInitialized) {
                    await this.initialize();
                }

                // Load image
                const img = await this.loadImage(imageSource);

                // Create canvas and preprocess
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);

                // Preprocess
                const processedCanvas = await this.preprocessImage(canvas);

                // Run OCR
                const result = await this.worker.recognize(processedCanvas);
                const measurements = this.parseOCRText(result.data.text);

                return {
                    success: true,
                    measurements,
                    rawText: result.data.text,
                    confidence: result.data.confidence
                };

            } catch (error) {
                console.error('OCR extraction failed:', error);
                return { success: false, error: error.message, measurements: [] };
            } finally {
                this.isProcessing = false;
            }
        }

        /**
         * Load image from URL or base64
         */
        loadImage(source) {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => resolve(img);
                img.onerror = () => reject(new Error('Failed to load image'));
                img.src = source;
            });
        }

        /**
         * Preprocess image for better OCR accuracy
         * Key techniques: contrast enhancement, binarization, noise reduction
         */
        async preprocessImage(canvas) {
            const ctx = canvas.getContext('2d');
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;

            // Create output canvas (upscale for better accuracy)
            const scale = canvas.width < 1000 ? 2 : 1;
            const outputCanvas = document.createElement('canvas');
            outputCanvas.width = canvas.width * scale;
            outputCanvas.height = canvas.height * scale;
            const outputCtx = outputCanvas.getContext('2d');

            // Draw scaled image
            outputCtx.imageSmoothingEnabled = true;
            outputCtx.drawImage(canvas, 0, 0, outputCanvas.width, outputCanvas.height);

            // Get the scaled image data
            const scaledData = outputCtx.getImageData(0, 0, outputCanvas.width, outputCanvas.height);
            const pixels = scaledData.data;

            // Step 1: Convert to grayscale and enhance contrast
            for (let i = 0; i < pixels.length; i += 4) {
                // Convert to grayscale
                const gray = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];

                // Enhance contrast (stretch histogram)
                let enhanced = (gray - 50) * 1.5 + 50;
                enhanced = Math.max(0, Math.min(255, enhanced));

                pixels[i] = pixels[i + 1] = pixels[i + 2] = enhanced;
            }

            // Step 2: Apply adaptive thresholding for binarization
            // This helps separate white/yellow text from dark ultrasound background
            const width = outputCanvas.width;
            const height = outputCanvas.height;
            const windowSize = 15;
            const threshold = 15;

            const binaryPixels = new Uint8ClampedArray(pixels.length);

            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const idx = (y * width + x) * 4;

                    // Calculate local mean in window
                    let sum = 0;
                    let count = 0;

                    for (let wy = Math.max(0, y - windowSize); wy < Math.min(height, y + windowSize); wy++) {
                        for (let wx = Math.max(0, x - windowSize); wx < Math.min(width, x + windowSize); wx++) {
                            sum += pixels[(wy * width + wx) * 4];
                            count++;
                        }
                    }

                    const localMean = sum / count;
                    const pixelValue = pixels[idx];

                    // Binarize: white if pixel is significantly brighter than local mean
                    const binary = pixelValue > localMean + threshold ? 255 : 0;

                    binaryPixels[idx] = binary;
                    binaryPixels[idx + 1] = binary;
                    binaryPixels[idx + 2] = binary;
                    binaryPixels[idx + 3] = 255;
                }
            }

            // Apply binary result
            scaledData.data.set(binaryPixels);
            outputCtx.putImageData(scaledData, 0, 0);

            // Step 3: Invert if needed (Tesseract works better with dark text on light background)
            // Check if most text appears to be white on black
            let lightPixels = 0;
            for (let i = 0; i < binaryPixels.length; i += 4) {
                if (binaryPixels[i] > 128) lightPixels++;
            }

            const lightRatio = lightPixels / (binaryPixels.length / 4);

            // If less than 30% is light, assume white text on dark - invert
            if (lightRatio < 0.3) {
                const finalData = outputCtx.getImageData(0, 0, outputCanvas.width, outputCanvas.height);
                for (let i = 0; i < finalData.data.length; i += 4) {
                    finalData.data[i] = 255 - finalData.data[i];
                    finalData.data[i + 1] = 255 - finalData.data[i + 1];
                    finalData.data[i + 2] = 255 - finalData.data[i + 2];
                }
                outputCtx.putImageData(finalData, 0, 0);
            }

            return outputCanvas;
        }

        /**
         * Parse OCR text to extract measurements
         */
        parseOCRText(text) {
            const measurements = [];
            const foundKeys = new Set();

            // Clean up OCR artifacts
            text = text
                .replace(/[|]/g, 'l')  // Common OCR mistake
                .replace(/[0O]/g, (m, offset, str) => {
                    // Context-aware: if surrounded by digits, likely 0
                    const before = str[offset - 1];
                    const after = str[offset + 1];
                    if (/\d/.test(before) || /\d/.test(after)) return '0';
                    return m;
                });

            // Try each measurement pattern
            for (const [key, pattern] of Object.entries(this.measurementPatterns)) {
                if (key === 'dimensions' || key === 'generic') continue; // Handle separately

                let match;
                pattern.lastIndex = 0; // Reset regex

                while ((match = pattern.exec(text)) !== null) {
                    const measurementKey = `${key}_${match.index}`;
                    if (foundKeys.has(measurementKey)) continue;
                    foundKeys.add(measurementKey);

                    let value, unit;

                    if (key === 'ga') {
                        // Gestational age: weeks + days
                        value = match[2] ? `${match[1]}w${match[2]}d` : `${match[1]}w`;
                        unit = 'weeks';
                    } else if (key === 'kidney' || key === 'uterus' || key === 'ovary' ||
                               key === 'thyroidRight' || key === 'thyroidLeft') {
                        // Dimensions: L x W x H
                        value = match[3]
                            ? `${match[1]} × ${match[2]} × ${match[3]}`
                            : `${match[1]} × ${match[2]}`;
                        unit = match[4] || 'cm';
                    } else {
                        value = parseFloat(match[1]);
                        unit = match[2] || this.getDefaultUnit(key);
                    }

                    measurements.push({
                        name: this.measurementNames[key] || key,
                        value: value,
                        unit: unit,
                        category: this.categoryMap[key] || 'general',
                        source: 'ocr',
                        confidence: 'auto-detected',
                        rawMatch: match[0]
                    });
                }
            }

            // If no specific measurements found, try generic patterns
            if (measurements.length === 0) {
                const dimensionPattern = this.measurementPatterns.dimensions;
                let match;
                dimensionPattern.lastIndex = 0;

                while ((match = dimensionPattern.exec(text)) !== null) {
                    const value = match[3]
                        ? `${match[1]} × ${match[2]} × ${match[3]}`
                        : `${match[1]} × ${match[2]}`;

                    measurements.push({
                        name: 'Dimension',
                        value: value,
                        unit: match[4] || 'cm',
                        category: 'general',
                        source: 'ocr',
                        rawMatch: match[0]
                    });
                }
            }

            return measurements;
        }

        /**
         * Get default unit for a measurement type
         */
        getDefaultUnit(key) {
            const unitDefaults = {
                bpd: 'mm', hc: 'mm', ac: 'mm', fl: 'mm', crl: 'mm',
                efw: 'g', afi: 'cm',
                liver: 'cm', spleen: 'cm', cbd: 'mm', aorta: 'cm', gbWall: 'mm',
                isthmus: 'mm', endometrium: 'mm',
                psv: 'cm/s', edv: 'cm/s', ri: '', pi: ''
            };
            return unitDefaults[key] || 'cm';
        }

        /**
         * Terminate the worker to free resources
         */
        async terminate() {
            if (this.worker) {
                await this.worker.terminate();
                this.worker = null;
                this.isInitialized = false;
            }
        }
    }

    // Export to global namespace
    window.DICOM_VIEWER.OCRMeasurementExtractor = OCRMeasurementExtractor;

    // Create singleton instance
    window.DICOM_VIEWER.ocrExtractor = new OCRMeasurementExtractor();

    console.log('✓ OCR Measurement Extractor module loaded');

})();
