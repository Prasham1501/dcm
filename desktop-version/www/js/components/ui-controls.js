// UI Controls Component - Fixed and Enhanced
window.DICOM_VIEWER.UIControls = {
  initialize() {
        this.setupEnhancementControls();
        this.setupLayoutControls();
        // this.setupCrosshairControls(); // REMOVE or comment out the old call
        this.setupReferenceAndCrosshairControls(); // ADD the new call
        this.setupWindowLevelControls();
        this.setupImageNavigation();
        this.setupCineControls();
        this.setupToolPanel();
        this.setupMPRControls();
        this.setupAIControls();
        this.setupDisplayOptions();
        this.setupExportControls();
        this.setupKeyboardShortcuts();
        this.setupImageManipulationControls();
        this.setupAdvancedControls();
    },
  // Replace the setupEnhancementControls method in ui-controls.js
  setupEnhancementControls() {
    let debounceTimer;

    const applyEnhancementsToAllViewports = () => {
      const brightnessSlider = document.getElementById("brightnessSlider");
      const contrastSlider = document.getElementById("contrastSlider");
      const sharpenSlider = document.getElementById("sharpenSlider");

      if (!brightnessSlider || !contrastSlider || !sharpenSlider) {
        console.error("Enhancement sliders not found");
        return;
      }

      const brightness = parseInt(brightnessSlider.value);
      const contrast = parseFloat(contrastSlider.value);
      const sharpening = parseFloat(sharpenSlider.value);

      // Update value displays
      const brightnessValue = document.getElementById("brightnessValue");
      const contrastValue = document.getElementById("contrastValue");
      const sharpenValue = document.getElementById("sharpenValue");

      if (brightnessValue)
        brightnessValue.textContent =
          brightness > 0 ? `+${brightness}` : brightness;
      if (contrastValue) contrastValue.textContent = `${contrast}x`;
      if (sharpenValue) sharpenValue.textContent = sharpening.toFixed(1);

      const viewports = window.DICOM_VIEWER.MANAGERS.viewportManager
        ? window.DICOM_VIEWER.MANAGERS.viewportManager.getAllViewports()
        : document.querySelectorAll(".viewport");

      viewports.forEach((viewport) => {
        if (window.DICOM_VIEWER.MANAGERS.enhancementManager) {
          window.DICOM_VIEWER.MANAGERS.enhancementManager.applyEnhancement(
            viewport,
            brightness,
            contrast,
            sharpening
          );
        }
      });

      window.DICOM_VIEWER.updateViewportInfo();
    };

    // Setup enhanced sliders with better responsiveness
    ["brightnessSlider", "contrastSlider", "sharpenSlider"].forEach((id) => {
      const slider = document.getElementById(id);
      if (slider) {
        // Remove old event listener if it exists
        slider.removeEventListener("input", slider._enhancementHandler);

        // Create new optimized handler
        slider._enhancementHandler = (e) => {
          // Clear existing timer
          clearTimeout(debounceTimer);

          // Apply changes immediately for smooth response (no debounce for input)
          applyEnhancementsToAllViewports();

          // Set a very short debounce only for performance optimization
          debounceTimer = setTimeout(() => {
            // Final application after user stops adjusting
            applyEnhancementsToAllViewports();
          }, 50);
        };

        slider.addEventListener("input", slider._enhancementHandler);

        // Add mouseup event for final adjustment
        slider.addEventListener("mouseup", applyEnhancementsToAllViewports);

        console.log(`Setup enhanced control for ${id}`);
      }
    });

    // Create or update reset button with enhanced functionality
    let resetBtn = document.querySelector(".enhancement-reset-btn");
    if (!resetBtn) {
      resetBtn = document.createElement("button");
      resetBtn.className =
        "btn btn-sm btn-outline-warning w-100 mt-2 enhancement-reset-btn";
      resetBtn.innerHTML =
        '<i class="bi bi-arrow-counterclockwise me-1"></i>Reset Enhancements';

      const enhancementControls = document.querySelector(
        ".enhancement-controls"
      );
      if (enhancementControls) {
        enhancementControls.appendChild(resetBtn);
      }
    }

    resetBtn.removeEventListener("click", resetBtn._resetHandler);
    resetBtn._resetHandler = () => {
      if (window.DICOM_VIEWER.MANAGERS.enhancementManager) {
        // Smooth reset animation
        resetBtn.innerHTML =
          '<i class="bi bi-arrow-repeat me-1"></i>Resetting...';
        resetBtn.disabled = true;

        setTimeout(() => {
          window.DICOM_VIEWER.MANAGERS.enhancementManager.resetAllEnhancements();
          window.DICOM_VIEWER.showAISuggestion(
            "All image enhancements reset to original DICOM values"
          );

          // Reset button state
          resetBtn.innerHTML =
            '<i class="bi bi-arrow-counterclockwise me-1"></i>Reset Enhancements';
          resetBtn.disabled = false;

          // Clear value displays
          const brightnessValue = document.getElementById("brightnessValue");
          const contrastValue = document.getElementById("contrastValue");
          const sharpenValue = document.getElementById("sharpenValue");
          if (brightnessValue) brightnessValue.textContent = "0";
          if (contrastValue) contrastValue.textContent = "1.0x";
          if (sharpenValue) sharpenValue.textContent = "0.0";
        }, 300);
      }
    };
    resetBtn.addEventListener("click", resetBtn._resetHandler);
    resetBtn.disabled = false;
    resetBtn.style.opacity = "1";
  },

  setupLayoutControls() {
    const layoutButtons = document.querySelectorAll("[data-layout]");
    console.log('[DEBUG] setupLayoutControls found', layoutButtons.length, 'layout buttons');

    layoutButtons.forEach((btn) => {
      btn.removeEventListener("click", btn._layoutHandler);
      btn._layoutHandler = (e) => {
        e.preventDefault();
        const layout = e.target.closest("[data-layout]").dataset.layout;

        console.log('[DEBUG] Layout button clicked:', layout);
        console.log('[DEBUG] viewportManager exists:', !!window.DICOM_VIEWER.MANAGERS.viewportManager);

        if (
          window.DICOM_VIEWER.MANAGERS.viewportManager &&
          window.DICOM_VIEWER.MANAGERS.viewportManager.switchLayout(layout)
        ) {
          document.querySelectorAll("[data-layout]").forEach((b) => {
            b.classList.remove("btn-primary");
            b.classList.add("btn-secondary");
          });

          e.target.closest("[data-layout]").classList.remove("btn-secondary");
          e.target.closest("[data-layout]").classList.add("btn-primary");

          console.log(`[DEBUG] Layout switched to: ${layout}`);
          if (window.DICOM_VIEWER.showAISuggestion) {
            window.DICOM_VIEWER.showAISuggestion(`Layout changed to ${layout}`);
          }
        } else {
          console.error('[DEBUG] Layout switch failed for:', layout);
        }
      };
      btn.addEventListener("click", btn._layoutHandler);
    });
  },

// REPLACE setupCrosshairControls WITH THIS NEW METHOD
    setupReferenceAndCrosshairControls() {
        const crosshairCheckbox = document.getElementById('showCrosshairs');
        const referenceLinesCheckbox = document.getElementById('enableReferenceLines');
        const crosshairManager = window.DICOM_VIEWER.MANAGERS.crosshairManager;
        const referenceLinesManager = window.DICOM_VIEWER.MANAGERS.referenceLinesManager;

        // If elements don't exist, just skip this setup - not an error
        if (!crosshairCheckbox || !referenceLinesCheckbox) {
            console.log('Crosshair/Reference line checkboxes not found in UI - skipping setup');
            return;
        }

        if (!crosshairManager || !referenceLinesManager) {
            console.warn('Crosshair or reference lines manager not initialized');
            return;
        }

        // --- Event Listener for Crosshairs Checkbox ---
        crosshairCheckbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                // Enable crosshairs
                crosshairManager.enable();
                
                // Disable reference lines and uncheck its box
                referenceLinesManager.disable();
                referenceLinesCheckbox.checked = false;
                
                window.DICOM_VIEWER.showAISuggestion('Crosshairs enabled');
            } else {
                // If the user unchecks it, disable it.
                crosshairManager.disable();
            }
        });

        // --- Event Listener for Reference Lines Checkbox ---
        referenceLinesCheckbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                // Enable reference lines
                referenceLinesManager.enable();
                
                // Disable crosshairs and uncheck its box
                crosshairManager.disable();
                crosshairCheckbox.checked = false;

                window.DICOM_VIEWER.showAISuggestion('Reference Lines enabled');
            } else {
                // If the user unchecks it, disable it.
                referenceLinesManager.disable();
            }
        });
        
        // --- Initialize on page load based on default checked state ---
        if (crosshairCheckbox.checked) {
            crosshairManager.enable();
            referenceLinesManager.disable();
        } else if (referenceLinesCheckbox.checked) {
            referenceLinesManager.enable();
            crosshairManager.disable();
        } else {
            crosshairManager.disable();
            referenceLinesManager.disable();
        }

        console.log('Reference Lines and Crosshairs controls initialized with mutual exclusivity.');
    },

  setupWindowLevelControls() {
    const windowSlider = document.getElementById("windowSlider");
    const levelSlider = document.getElementById("levelSlider");
    const windowValue = document.getElementById("windowValue");
    const levelValue = document.getElementById("levelValue");

    if (windowSlider && windowValue) {
      windowSlider.addEventListener("input", (event) => {
        const windowWidth = parseInt(event.target.value);
        windowValue.textContent = windowWidth;
        window.DICOM_VIEWER.applyWindowLevel(
          windowWidth,
          parseInt(levelSlider.value)
        );
      });
    }

    if (levelSlider && levelValue) {
      levelSlider.addEventListener("input", (event) => {
        const windowLevel = parseInt(event.target.value);
        levelValue.textContent = windowLevel;
        window.DICOM_VIEWER.applyWindowLevel(
          parseInt(windowSlider.value),
          windowLevel
        );
      });
    }

    document.querySelectorAll(".preset-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const presetName = e.target.dataset.preset;
        if (presetName) {
          window.DICOM_VIEWER.applyWindowLevelPreset(presetName);
        }
      });
    });
  },

  setupImageNavigation() {
    const imageSlider = document.getElementById("imageSlider");
    const prevBtn = document.getElementById("prevImage");
    const nextBtn = document.getElementById("nextImage");

    if (imageSlider) {
      imageSlider.addEventListener(
        "input",
        window.DICOM_VIEWER.handleImageSliderChange
      );
    }
    if (prevBtn) {
      prevBtn.addEventListener("click", () =>
        window.DICOM_VIEWER.navigateImage(-1)
      );
    }
    if (nextBtn) {
      nextBtn.addEventListener("click", () =>
        window.DICOM_VIEWER.navigateImage(1)
      );
    }
  },

  setupCineControls() {
    const playPauseBtn = document.getElementById("playPause");
    const stopBtn = document.getElementById("stopCine");
    const fpsSlider = document.getElementById("fpsSlider");

    if (playPauseBtn) {
      playPauseBtn.addEventListener(
        "click",
        window.DICOM_VIEWER.toggleCinePlay
      );
    }
    if (stopBtn) {
      stopBtn.addEventListener("click", window.DICOM_VIEWER.stopCine);
    }
    if (fpsSlider) {
      fpsSlider.addEventListener("input", window.DICOM_VIEWER.handleFPSChange);
    }
  },

  setupToolPanel() {
    const toolsPanel = document.getElementById("tools-panel");
    if (toolsPanel) {
      toolsPanel.addEventListener(
        "click",
        window.DICOM_VIEWER.handleToolSelection
      );
    }
  },

  setupMPRControls() {
    const enableMPRCheckbox = document.getElementById("enableMPR");
    const axialSlider = document.getElementById("axialSlider");
    const sagittalSlider = document.getElementById("sagittalSlider");
    const coronalSlider = document.getElementById("coronalSlider");

    // Check if MPR checkbox exists before setting up
    if (!enableMPRCheckbox) {
      console.log('MPR checkbox not found - skipping MPR controls setup');
      return;
    }

    if (enableMPRCheckbox) {
      enableMPRCheckbox.addEventListener("change", function () {
        window.DICOM_VIEWER.STATE.mprEnabled = this.checked;
        const mprNav = document.getElementById("mprNavigation");
        if (mprNav) {
          mprNav.style.display = window.DICOM_VIEWER.STATE.mprEnabled
            ? "block"
            : "none";
        }
        if (
          window.DICOM_VIEWER.STATE.currentSeriesImages.length > 1 &&
          window.DICOM_VIEWER.STATE.mprEnabled
        ) {
          window.DICOM_VIEWER.setupMPRViews();
        }
      });
    }

    if (axialSlider) {
      axialSlider.addEventListener("input", (e) =>
        window.DICOM_VIEWER.updateMPRSlice("axial", e.target.value / 100)
      );
    }
    if (sagittalSlider) {
      sagittalSlider.addEventListener("input", (e) =>
        window.DICOM_VIEWER.updateMPRSlice("sagittal", e.target.value / 100)
      );
    }
    if (coronalSlider) {
      coronalSlider.addEventListener("input", (e) =>
        window.DICOM_VIEWER.updateMPRSlice("coronal", e.target.value / 100)
      );
    }

    // MPR view buttons - FIXED VERSION
    const mprButtons = ["mprAxial", "mprSagittal", "mprCoronal", "mprAll"];
    mprButtons.forEach((buttonId) => {
      const btn = document.getElementById(buttonId);
      if (btn) {
        btn.addEventListener("click", async function (e) {
          e.preventDefault();

          // Show specific loading indicator for the clicked button
          const orientation = buttonId.replace("mpr", "").toLowerCase();
          const orientationName =
            orientation.charAt(0).toUpperCase() + orientation.slice(1);

          if (orientation === "all") {
            this.innerHTML =
              '<span class="spinner-border spinner-border-sm me-1"></span>Loading All Views...';
          } else {
            this.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span>Loading ${orientationName}...`;
          }
          this.disabled = true;

          try {
            // Build volume if needed WITHOUT clearing existing viewports
            if (!window.DICOM_VIEWER.MANAGERS.mprManager.volumeData) {
              await window.DICOM_VIEWER.setupMPRViews();
              if (!window.DICOM_VIEWER.MANAGERS.mprManager.volumeData) {
                window.DICOM_VIEWER.showAISuggestion(
                  "Failed to build MPR volume. Please try again."
                );
                return;
              }
            }

            // Execute the specific MPR action
            switch (buttonId) {
              case "mprAxial":
                window.DICOM_VIEWER.focusMPRView("axial");
                break;
              case "mprSagittal":
                window.DICOM_VIEWER.focusMPRView("sagittal");
                break;
              case "mprCoronal":
                window.DICOM_VIEWER.focusMPRView("coronal");
                break;
              case "mprAll":
                window.DICOM_VIEWER.showAllMPRViews();
                break;
            }
          } finally {
            // Restore button text and enable it
            const displayNames = {
              axial: "Axial",
              sagittal: "Sagittal",
              coronal: "Coronal",
              all: "All Views",
            };
            this.innerHTML = displayNames[orientation];
            this.disabled = false;
          }
        });
      }
    });
  },

  setupAIControls() {
    const aiButtons = {
      autoAdjustWL: window.DICOM_VIEWER.autoAdjustWindowLevel,
      detectAbnormalities: window.DICOM_VIEWER.detectAbnormalities,
      measureDistance: window.DICOM_VIEWER.smartMeasure,
      enhanceImage: window.DICOM_VIEWER.enhanceImageQuality,
    };

    Object.entries(aiButtons).forEach(([id, handler]) => {
      const btn = document.getElementById(id);
      if (btn && handler) {
        btn.addEventListener("click", handler);
      }
    });
  },

  // Update the setupDisplayOptions method in ui-controls.js
  setupDisplayOptions() {
    // Setup Interpolation Control
    const interpolationSelect = document.getElementById("interpolationSelect");
    if (interpolationSelect) {
      // Remove old event listener
      interpolationSelect.removeEventListener(
        "change",
        interpolationSelect._interpolationHandler
      );

      // Add new functional handler
      interpolationSelect._interpolationHandler =
        window.DICOM_VIEWER.changeInterpolation;
      interpolationSelect.addEventListener(
        "change",
        interpolationSelect._interpolationHandler
      );

      console.log("✓ Interpolation control setup");
    }

    // Setup MPR Quality Control
    const mprQualitySelect = document.getElementById("mprQuality");
    if (mprQualitySelect) {
      // Remove old event listener
      mprQualitySelect.removeEventListener(
        "change",
        mprQualitySelect._qualityHandler
      );

      // Add new functional handler
      mprQualitySelect._qualityHandler = window.DICOM_VIEWER.changeMPRQuality;
      mprQualitySelect.addEventListener(
        "change",
        mprQualitySelect._qualityHandler
      );

      console.log("✓ MPR Quality control setup");
    }

    // Keep existing functionality for other controls
    const clearMeasurementsBtn = document.getElementById("clearMeasurements");
    if (clearMeasurementsBtn) {
      clearMeasurementsBtn.addEventListener(
        "click",
        window.DICOM_VIEWER.clearAllMeasurements
      );
    }

    const fullscreenBtn = document.getElementById("fullscreenBtn");
    if (fullscreenBtn) {
      fullscreenBtn.addEventListener(
        "click",
        window.DICOM_VIEWER.toggleFullscreen
      );
    }

    console.log("Display options controls initialized");
  },

  // Add to the setupExportControls function in ui-controls.js
  setupExportControls() {
    // Enhanced export controls
    const exportControls = {
      exportImage: window.DICOM_VIEWER.exportImage,
      exportReport: window.DICOM_VIEWER.exportReport,
      exportDicom: window.DICOM_VIEWER.exportDICOM,
      exportMPR: window.DICOM_VIEWER.exportMPRViews,
    };

    Object.entries(exportControls).forEach(([id, handler]) => {
      const btn = document.getElementById(id);
      if (btn && handler) {
        btn.removeEventListener("click", btn._exportHandler);
        btn._exportHandler = handler;
        btn.addEventListener("click", btn._exportHandler);
      }
    });

    console.log("Enhanced export controls initialized");
  },

  setupImageManipulationControls() {
    const manipulationControls = {
      resetBtn: window.DICOM_VIEWER.resetActiveViewport,
      invertBtn: () => window.DICOM_VIEWER.invertImage(),
      flipHBtn: () => window.DICOM_VIEWER.flipImage("horizontal"),
      flipVBtn: () => window.DICOM_VIEWER.flipImage("vertical"),
      rotateLeftBtn: () => window.DICOM_VIEWER.rotateImage(-90),
      rotateRightBtn: () => window.DICOM_VIEWER.rotateImage(90),
    };

    Object.entries(manipulationControls).forEach(([id, handler]) => {
      const btn = document.getElementById(id);
      if (btn && handler) {
        btn.addEventListener("click", handler);
      }
    });
  },

setupAdvancedControls() {
    // Existing synchronization controls...
    const syncControls = ["syncScroll", "syncWL", "syncZoom"];
    syncControls.forEach((id) => {
        const checkbox = document.getElementById(id);
        if (checkbox) {
            checkbox.addEventListener("change", function () {
                console.log(`${id} ${this.checked ? "enabled" : "disabled"}`);
                window.DICOM_VIEWER.showAISuggestion(
                    `${id.replace("sync", "")} synchronization ${
                        this.checked ? "enabled" : "disabled"
                    }`
                );
            });
        }
    });


     const customMouseToggle = document.getElementById('customMouseControls');
    if (customMouseToggle) {
        customMouseToggle.addEventListener('change', function() {
            if (window.DICOM_VIEWER.MANAGERS.mouseControls) {
                if (this.checked) {
                    window.DICOM_VIEWER.MANAGERS.mouseControls.enable();
                    window.DICOM_VIEWER.showAISuggestion('Custom mouse controls enabled: Wheel=Zoom, Right-drag=W/L, Middle-drag=Pan');
                } else {
                    window.DICOM_VIEWER.MANAGERS.mouseControls.disable();
                    window.DICOM_VIEWER.showAISuggestion('Custom mouse controls disabled');
                }
            }
        });
        
        // Enable by default
        customMouseToggle.checked = true;
    }
    
    // MPR Quality control
    const mprQualitySelect = document.getElementById("mprQuality");
    if (mprQualitySelect) {
      mprQualitySelect.addEventListener("change", function () {
        console.log(`MPR quality changed to: ${this.value}`);
        window.DICOM_VIEWER.showAISuggestion(
          `MPR quality set to ${this.value}`
        );
      });
    }
  },

  setupKeyboardShortcuts() {
    document.addEventListener("keydown", (event) => {
      // Don't trigger shortcuts if user is typing in input fields
      if (
        event.target.tagName === "INPUT" ||
        event.target.tagName === "TEXTAREA" ||
        event.target.isContentEditable
      ) {
        return;
      }

      const toolsPanel = document.getElementById("tools-panel");
      const key = event.key.toLowerCase();

      // Prevent default for handled keys
      const handledKeys = [
        "p",
        "z",
        "w",
        "l",
        "r",
        "i",
        "m",
        "c",
        "1",
        "2",
        " ",
        "f",
        "a",
        "escape",
        "arrowleft",
        "arrowright",
        "arrowup",
        "arrowdown",
      ];
      if (
        handledKeys.includes(key) ||
        (event.shiftKey && ["arrowup", "arrowdown"].includes(key))
      ) {
        event.preventDefault();
      }

      switch (key) {
        case "p":
          toolsPanel?.querySelector('[data-tool="Pan"]')?.click();
          break;
        case "z":
          toolsPanel?.querySelector('[data-tool="Zoom"]')?.click();
          break;
        case "w":
          toolsPanel?.querySelector('[data-tool="Wwwc"]')?.click();
          break;
        case "l":
          toolsPanel?.querySelector('[data-tool="Length"]')?.click();
          break;
        case "r":
          window.DICOM_VIEWER.resetActiveViewport();
          break;
        case "i":
          window.DICOM_VIEWER.invertImage();
          break;
        case "m":
          const enableMPRCheckbox = document.getElementById("enableMPR");
          if (enableMPRCheckbox) {
            enableMPRCheckbox.checked = !enableMPRCheckbox.checked;
            enableMPRCheckbox.dispatchEvent(new Event("change"));
          }
          break;
        case "c":
          window.DICOM_VIEWER.toggleCrosshairs();
          break;
        case "1":
          window.DICOM_VIEWER.setViewportLayout("1x1");
          break;
        case "2":
          window.DICOM_VIEWER.setViewportLayout("2x2");
          break;
        case " ":
          window.DICOM_VIEWER.toggleCinePlay();
          break;
        case "f":
          window.DICOM_VIEWER.toggleFullscreen();
          break;
        case "a":
          window.DICOM_VIEWER.autoAdjustWindowLevel();
          break;
        case "escape":
          if (document.fullscreenElement) {
            window.DICOM_VIEWER.toggleFullscreen();
          }
          break;
        case "arrowleft":
          window.DICOM_VIEWER.navigateImage(-1);
          break;
        case "arrowright":
          window.DICOM_VIEWER.navigateImage(1);
          break;
        case "arrowup":
          if (event.shiftKey) {
            const sagittalSlider = document.getElementById("sagittalSlider");
            if (sagittalSlider) {
              const newPos = Math.max(
                0,
                (window.DICOM_VIEWER.STATE.currentSlicePositions.sagittal ||
                  0.5) - 0.05
              );
              sagittalSlider.value = newPos * 100;
              window.DICOM_VIEWER.updateMPRSlice("sagittal", newPos);
            }
          }
          break;
        case "arrowdown":
          if (event.shiftKey) {
            const sagittalSlider = document.getElementById("sagittalSlider");
            if (sagittalSlider) {
              const newPos = Math.min(
                1,
                (window.DICOM_VIEWER.STATE.currentSlicePositions.sagittal ||
                  0.5) + 0.05
              );
              sagittalSlider.value = newPos * 100;
              window.DICOM_VIEWER.updateMPRSlice("sagittal", newPos);
            }
          }
          break;
      }
    });

    // Show keyboard shortcuts help
    setTimeout(() => {
      console.log(
        "Keyboard shortcuts loaded: P(pan), Z(zoom), W(window/level), L(length), R(reset), I(invert), M(MPR), C(crosshairs), 1/2(layouts), Space(cine), F(fullscreen), A(auto W/L)"
      );
    }, 1000);
  },
};
