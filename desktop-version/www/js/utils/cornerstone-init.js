// Cornerstone initialization and configuration
window.DICOM_VIEWER.CornerstoneInit = {
    initialize() {
        console.log('Initializing Cornerstone libraries...');

        // Check if all required libraries are loaded
        if (typeof cornerstone === 'undefined') {
            throw new Error('Cornerstone is not loaded');
        }
        if (typeof cornerstoneWADOImageLoader === 'undefined') {
            throw new Error('cornerstoneWADOImageLoader is not loaded');
        }
        if (typeof cornerstoneTools === 'undefined') {
            throw new Error('cornerstoneTools is not loaded');
        }

        console.log('All Cornerstone libraries loaded successfully');

        // Initialize Cornerstone WADO Image Loader
        this.initializeWADOImageLoader();

        // Initialize Cornerstone Tools
        this.initializeCornerstoneTools();

        // Add tools
        this.addTools();

        console.log('Cornerstone initialization completed');
    },

    initializeWADOImageLoader() {
        try {
            const config = {
                maxWebWorkers: navigator.hardwareConcurrency || 1,
                startWebWorkersOnDemand: true,
                taskConfiguration: {
                    'decodeTask': {
                        initializeCodecsOnStartup: false,
                        usePDFJS: false,
                        strict: false
                    }
                }
            };

            cornerstoneWADOImageLoader.webWorkerManager.initialize(config);
            cornerstoneWADOImageLoader.external.cornerstone = cornerstone;
            cornerstoneWADOImageLoader.external.dicomParser = dicomParser;

            console.log('WADO Image Loader configured successfully');
        } catch (error) {
            console.error('Error configuring WADO Image Loader:', error);
            throw error;
        }
    },

    initializeCornerstoneTools() {
        try {
            cornerstoneTools.external.cornerstone = cornerstone;
            cornerstoneTools.external.cornerstoneMath = cornerstoneMath;
            cornerstoneTools.external.Hammer = Hammer;

            cornerstoneTools.init({
                globalToolSyncEnabled: true
            });

            console.log('Cornerstone Tools initialized successfully');
        } catch (error) {
            console.error('Error initializing Cornerstone Tools:', error);
            throw error;
        }
    },

    addTools() {
        const toolNameMap = window.DICOM_VIEWER.CONSTANTS.TOOL_NAME_MAP;
        
        Object.entries(toolNameMap).forEach(([displayName, toolName]) => {
            try {
                const toolClass = cornerstoneTools[`${toolName}Tool`];
                if (toolClass) {
                    cornerstoneTools.addTool(toolClass);
                    console.log(`Added tool: ${toolName}`);
                } else {
                    console.warn(`Tool class not found: ${toolName}Tool`);
                }
            } catch (error) {
                console.warn(`Could not add tool: ${toolName}`, error);
            }
        });
    }
};