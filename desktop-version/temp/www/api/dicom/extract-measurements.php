<?php
/**
 * DICOM Measurement Extraction API
 *
 * Extracts measurements from DICOM files including:
 * - Structured Reports (SR) with Content Sequence (0040,A730)
 * - Numeric Measurement Sequences
 * - Overlay annotations
 * - Graphic annotations from Presentation States
 *
 * References:
 * - DICOM Standard: https://dicom.innolitics.com/ciods/enhanced-sr/sr-document-content/0040a730
 * - SR Template TID 5000 for OB-GYN Ultrasound
 * - Content Sequence for structured measurements
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once __DIR__ . '/../../includes/config.php';

class DicomMeasurementExtractor {
    private $orthancUrl;
    private $orthancAuth;

    // DICOM tags for measurements
    const TAG_CONTENT_SEQUENCE = '0040,A730';
    const TAG_CONCEPT_NAME_CODE_SEQ = '0040,A043';
    const TAG_MEASURED_VALUE_SEQ = '0040,A300';
    const TAG_NUMERIC_VALUE = '0040,A30A';
    const TAG_MEASUREMENT_UNITS_CODE_SEQ = '0040,08EA';
    const TAG_VALUE_TYPE = '0040,A040';
    const TAG_TEXT_VALUE = '0040,A160';
    const TAG_CODE_VALUE = '0008,0100';
    const TAG_CODE_MEANING = '0008,0104';
    const TAG_CODING_SCHEME = '0008,0102';

    // US Region Calibration tags
    const TAG_US_REGION_SEQUENCE = '0018,6011';
    const TAG_PHYSICAL_UNITS_X = '0018,6024';
    const TAG_PHYSICAL_UNITS_Y = '0018,6026';
    const TAG_PHYSICAL_DELTA_X = '0018,602C';
    const TAG_PHYSICAL_DELTA_Y = '0018,602E';

    // Graphic Annotation tags
    const TAG_GRAPHIC_ANNOTATION_SEQ = '0070,0001';
    const TAG_GRAPHIC_OBJECT_SEQ = '0070,0009';
    const TAG_TEXT_OBJECT_SEQ = '0070,0008';
    const TAG_UNFORMATTED_TEXT_VALUE = '0070,0006';
    const TAG_GRAPHIC_DATA = '0070,0022';
    const TAG_GRAPHIC_TYPE = '0070,0023';

    // Common measurement concept codes (DICOM/SNOMED)
    private $measurementCodes = [
        // Obstetric measurements
        '11979-2' => ['name' => 'Biparietal Diameter (BPD)', 'category' => 'obstetric'],
        '11820-8' => ['name' => 'Head Circumference (HC)', 'category' => 'obstetric'],
        '11863-8' => ['name' => 'Abdominal Circumference (AC)', 'category' => 'obstetric'],
        '11963-6' => ['name' => 'Femur Length (FL)', 'category' => 'obstetric'],
        '11957-8' => ['name' => 'Crown Rump Length (CRL)', 'category' => 'obstetric'],
        '11948-7' => ['name' => 'Estimated Fetal Weight (EFW)', 'category' => 'obstetric'],

        // Abdominal organ measurements
        'G-D705' => ['name' => 'Liver Length', 'category' => 'abdominal'],
        'T-62000' => ['name' => 'Liver', 'category' => 'abdominal'],
        'T-D4000' => ['name' => 'Spleen Length', 'category' => 'abdominal'],
        'T-71000' => ['name' => 'Kidney', 'category' => 'abdominal'],
        'T-71100' => ['name' => 'Right Kidney', 'category' => 'abdominal'],
        'T-71200' => ['name' => 'Left Kidney', 'category' => 'abdominal'],
        'T-65000' => ['name' => 'Pancreas', 'category' => 'abdominal'],
        'T-63000' => ['name' => 'Gallbladder', 'category' => 'abdominal'],
        'T-48003' => ['name' => 'Aorta', 'category' => 'abdominal'],
        'T-48610' => ['name' => 'Common Bile Duct', 'category' => 'abdominal'],

        // Thyroid measurements
        'T-B6000' => ['name' => 'Thyroid', 'category' => 'thyroid'],
        'T-B6100' => ['name' => 'Right Thyroid Lobe', 'category' => 'thyroid'],
        'T-B6200' => ['name' => 'Left Thyroid Lobe', 'category' => 'thyroid'],
        'T-B6300' => ['name' => 'Thyroid Isthmus', 'category' => 'thyroid'],

        // Cardiac measurements
        '18083-6' => ['name' => 'Left Ventricular Ejection Fraction', 'category' => 'cardiac'],
        '18154-5' => ['name' => 'LV Internal Dimension Diastole', 'category' => 'cardiac'],
        '18155-2' => ['name' => 'LV Internal Dimension Systole', 'category' => 'cardiac'],
        '18156-0' => ['name' => 'Interventricular Septum Diastole', 'category' => 'cardiac'],
        '18157-8' => ['name' => 'LV Posterior Wall Diastole', 'category' => 'cardiac'],

        // Vascular measurements
        'G-0364' => ['name' => 'Diameter', 'category' => 'vascular'],
        'G-0368' => ['name' => 'Area', 'category' => 'vascular'],
        'G-037D' => ['name' => 'Peak Systolic Velocity', 'category' => 'vascular'],
        'G-037E' => ['name' => 'End Diastolic Velocity', 'category' => 'vascular'],
        'G-037F' => ['name' => 'Resistive Index', 'category' => 'vascular'],
        'G-0380' => ['name' => 'Pulsatility Index', 'category' => 'vascular'],

        // Generic measurements
        '121206' => ['name' => 'Distance', 'category' => 'generic'],
        '121207' => ['name' => 'Area', 'category' => 'generic'],
        '121208' => ['name' => 'Volume', 'category' => 'generic'],
        '121211' => ['name' => 'Path Length', 'category' => 'generic'],
        '121216' => ['name' => 'Circumference', 'category' => 'generic'],
    ];

    // Unit conversions
    private $unitCodes = [
        'cm' => 'cm',
        'mm' => 'mm',
        'm' => 'm',
        'cm2' => 'cm²',
        'mm2' => 'mm²',
        'cm3' => 'cm³',
        'ml' => 'ml',
        'cm/s' => 'cm/s',
        'm/s' => 'm/s',
        '%' => '%',
        'g' => 'g',
        'kg' => 'kg',
        'wk' => 'weeks',
        'd' => 'days',
        '{ratio}' => '',
    ];

    public function __construct() {
        $this->orthancUrl = rtrim(ORTHANC_URL, '/');
        $this->orthancAuth = base64_encode(ORTHANC_USERNAME . ':' . ORTHANC_PASSWORD);
    }

    /**
     * Main extraction method - combines all sources
     */
    public function extractMeasurements($instanceId, $studyId = null) {
        $measurements = [
            'structured_report' => [],
            'graphic_annotations' => [],
            'region_calibration' => [],
            'text_annotations' => [],
            'parsed_overlay' => [],
            'metadata' => []
        ];

        try {
            // Get instance tags
            $tags = $this->getInstanceTags($instanceId);
            if (!$tags) {
                throw new Exception("Could not retrieve instance tags");
            }

            // Store metadata
            $measurements['metadata'] = $this->extractMetadata($tags);

            // Check if this is a Structured Report
            $modality = $tags['0008,0060']['Value'] ?? '';
            $sopClassUID = $tags['0008,0016']['Value'] ?? '';

            if ($modality === 'SR' || $this->isStructuredReport($sopClassUID)) {
                // Extract from Content Sequence
                $measurements['structured_report'] = $this->extractFromContentSequence($tags);
            }

            // Extract graphic annotations (from presentation states or embedded)
            $measurements['graphic_annotations'] = $this->extractGraphicAnnotations($tags);

            // Extract text annotations
            $measurements['text_annotations'] = $this->extractTextAnnotations($tags);

            // Extract US Region Calibration data
            if (isset($tags[self::TAG_US_REGION_SEQUENCE])) {
                $measurements['region_calibration'] = $this->extractUSRegionCalibration($tags);
            }

            // Try to parse any overlay text for measurements
            $measurements['parsed_overlay'] = $this->parseOverlayText($instanceId);

            // If study ID provided, look for related SR instances
            if ($studyId) {
                $srMeasurements = $this->findRelatedStructuredReports($studyId);
                if (!empty($srMeasurements)) {
                    $measurements['structured_report'] = array_merge(
                        $measurements['structured_report'],
                        $srMeasurements
                    );
                }
            }

            // Consolidate and format measurements
            $consolidated = $this->consolidateMeasurements($measurements);

            return [
                'success' => true,
                'instanceId' => $instanceId,
                'modality' => $modality,
                'measurements' => $consolidated,
                'raw' => $measurements,
                'categories' => $this->categorizeMeasurements($consolidated)
            ];

        } catch (Exception $e) {
            return [
                'success' => false,
                'error' => $e->getMessage(),
                'instanceId' => $instanceId
            ];
        }
    }

    /**
     * Get instance tags from Orthanc
     */
    private function getInstanceTags($instanceId) {
        $url = "{$this->orthancUrl}/instances/{$instanceId}/tags";

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => [
                'Authorization: Basic ' . $this->orthancAuth,
                'Accept: application/json'
            ],
            CURLOPT_TIMEOUT => 30
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200) {
            return null;
        }

        return json_decode($response, true);
    }

    /**
     * Extract metadata from tags
     */
    private function extractMetadata($tags) {
        return [
            'modality' => $tags['0008,0060']['Value'] ?? 'Unknown',
            'studyDescription' => $tags['0008,1030']['Value'] ?? '',
            'seriesDescription' => $tags['0008,103E']['Value'] ?? '',
            'manufacturer' => $tags['0008,0070']['Value'] ?? '',
            'model' => $tags['0008,1090']['Value'] ?? '',
            'stationName' => $tags['0008,1010']['Value'] ?? '',
            'bodyPart' => $tags['0018,0015']['Value'] ?? '',
            'acquisitionDateTime' => $tags['0008,002A']['Value'] ?? $tags['0008,0020']['Value'] ?? ''
        ];
    }

    /**
     * Check if SOP Class is a Structured Report
     */
    private function isStructuredReport($sopClassUID) {
        $srSopClasses = [
            '1.2.840.10008.5.1.4.1.1.88.11', // Basic Text SR
            '1.2.840.10008.5.1.4.1.1.88.22', // Enhanced SR
            '1.2.840.10008.5.1.4.1.1.88.33', // Comprehensive SR
            '1.2.840.10008.5.1.4.1.1.88.34', // Comprehensive 3D SR
            '1.2.840.10008.5.1.4.1.1.88.35', // Extensible SR
            '1.2.840.10008.5.1.4.1.1.88.40', // Procedure Log
            '1.2.840.10008.5.1.4.1.1.88.50', // Mammography CAD SR
            '1.2.840.10008.5.1.4.1.1.88.65', // Chest CAD SR
            '1.2.840.10008.5.1.4.1.1.88.67', // X-Ray Radiation Dose SR
            '1.2.840.10008.5.1.4.1.1.88.68', // Spectacle Prescription Report
            '1.2.840.10008.5.1.4.1.1.88.69', // Macular Grid Thickness and Volume Report
            '1.2.840.10008.5.1.4.1.1.88.70', // Implantation Plan SR
        ];

        return in_array($sopClassUID, $srSopClasses);
    }

    /**
     * Extract measurements from Content Sequence (0040,A730)
     */
    private function extractFromContentSequence($tags, $parentConcept = null) {
        $measurements = [];

        $contentSeq = $tags[self::TAG_CONTENT_SEQUENCE] ?? null;
        if (!$contentSeq || !isset($contentSeq['Value'])) {
            return $measurements;
        }

        foreach ($contentSeq['Value'] as $item) {
            $valueType = $item[self::TAG_VALUE_TYPE]['Value'] ?? '';
            $conceptName = $this->extractConceptName($item);

            switch ($valueType) {
                case 'NUM':
                    // Numeric measurement
                    $measurement = $this->extractNumericMeasurement($item, $conceptName, $parentConcept);
                    if ($measurement) {
                        $measurements[] = $measurement;
                    }
                    break;

                case 'TEXT':
                    // Text value - might contain measurement info
                    $textValue = $item[self::TAG_TEXT_VALUE]['Value'] ?? '';
                    if ($this->looksLikeMeasurement($textValue)) {
                        $measurements[] = [
                            'type' => 'text',
                            'name' => $conceptName['meaning'] ?? 'Text Value',
                            'value' => $textValue,
                            'code' => $conceptName['code'] ?? null,
                            'source' => 'content_sequence'
                        ];
                    }
                    break;

                case 'CONTAINER':
                case 'INCLUDE':
                    // Recursively process nested content
                    if (isset($item[self::TAG_CONTENT_SEQUENCE])) {
                        $nested = $this->extractFromContentSequence($item, $conceptName);
                        $measurements = array_merge($measurements, $nested);
                    }
                    break;
            }
        }

        return $measurements;
    }

    /**
     * Extract concept name from content item
     */
    private function extractConceptName($item) {
        $conceptSeq = $item[self::TAG_CONCEPT_NAME_CODE_SEQ]['Value'][0] ?? null;
        if (!$conceptSeq) {
            return ['code' => null, 'meaning' => 'Unknown', 'scheme' => null];
        }

        return [
            'code' => $conceptSeq[self::TAG_CODE_VALUE]['Value'] ?? null,
            'meaning' => $conceptSeq[self::TAG_CODE_MEANING]['Value'] ?? 'Unknown',
            'scheme' => $conceptSeq[self::TAG_CODING_SCHEME]['Value'] ?? null
        ];
    }

    /**
     * Extract numeric measurement from content item
     */
    private function extractNumericMeasurement($item, $conceptName, $parentConcept = null) {
        $measuredValueSeq = $item[self::TAG_MEASURED_VALUE_SEQ]['Value'][0] ?? null;
        if (!$measuredValueSeq) {
            return null;
        }

        $numericValue = $measuredValueSeq[self::TAG_NUMERIC_VALUE]['Value'] ?? null;
        if ($numericValue === null) {
            return null;
        }

        // Get units
        $unitsSeq = $measuredValueSeq[self::TAG_MEASUREMENT_UNITS_CODE_SEQ]['Value'][0] ?? null;
        $unit = '';
        $unitCode = '';
        if ($unitsSeq) {
            $unitCode = $unitsSeq[self::TAG_CODE_VALUE]['Value'] ?? '';
            $unit = $this->unitCodes[$unitCode] ?? $unitsSeq[self::TAG_CODE_MEANING]['Value'] ?? $unitCode;
        }

        // Look up measurement info
        $code = $conceptName['code'] ?? '';
        $knownMeasurement = $this->measurementCodes[$code] ?? null;

        return [
            'type' => 'numeric',
            'name' => $knownMeasurement['name'] ?? $conceptName['meaning'],
            'value' => is_array($numericValue) ? $numericValue[0] : $numericValue,
            'unit' => $unit,
            'unitCode' => $unitCode,
            'code' => $code,
            'codingScheme' => $conceptName['scheme'],
            'category' => $knownMeasurement['category'] ?? 'generic',
            'parentConcept' => $parentConcept ? $parentConcept['meaning'] : null,
            'source' => 'structured_report'
        ];
    }

    /**
     * Extract graphic annotations
     */
    private function extractGraphicAnnotations($tags) {
        $annotations = [];

        $graphicAnnotationSeq = $tags[self::TAG_GRAPHIC_ANNOTATION_SEQ]['Value'] ?? null;
        if (!$graphicAnnotationSeq) {
            return $annotations;
        }

        foreach ($graphicAnnotationSeq as $annotation) {
            // Extract graphic objects (lines, circles, etc.)
            $graphicObjects = $annotation[self::TAG_GRAPHIC_OBJECT_SEQ]['Value'] ?? [];
            foreach ($graphicObjects as $graphic) {
                $graphicType = $graphic[self::TAG_GRAPHIC_TYPE]['Value'] ?? '';
                $graphicData = $graphic[self::TAG_GRAPHIC_DATA]['Value'] ?? [];

                if ($graphicType && !empty($graphicData)) {
                    $annotations[] = [
                        'type' => 'graphic',
                        'graphicType' => $graphicType,
                        'points' => $graphicData,
                        'source' => 'graphic_annotation'
                    ];
                }
            }

            // Extract text objects
            $textObjects = $annotation[self::TAG_TEXT_OBJECT_SEQ]['Value'] ?? [];
            foreach ($textObjects as $text) {
                $textValue = $text[self::TAG_UNFORMATTED_TEXT_VALUE]['Value'] ?? '';
                if ($textValue && $this->looksLikeMeasurement($textValue)) {
                    $parsed = $this->parseMeasurementText($textValue);
                    if ($parsed) {
                        $annotations[] = array_merge($parsed, ['source' => 'graphic_annotation']);
                    }
                }
            }
        }

        return $annotations;
    }

    /**
     * Extract text annotations from various tags
     */
    private function extractTextAnnotations($tags) {
        $annotations = [];

        // Check Image Comments
        $imageComments = $tags['0020,4000']['Value'] ?? '';
        if ($imageComments && $this->looksLikeMeasurement($imageComments)) {
            $parsed = $this->parseMeasurementText($imageComments);
            if ($parsed) {
                $annotations[] = array_merge($parsed, ['source' => 'image_comments']);
            }
        }

        // Check Series Description for measurements
        $seriesDesc = $tags['0008,103E']['Value'] ?? '';
        if ($seriesDesc && $this->looksLikeMeasurement($seriesDesc)) {
            $parsed = $this->parseMeasurementText($seriesDesc);
            if ($parsed) {
                $annotations[] = array_merge($parsed, ['source' => 'series_description']);
            }
        }

        return $annotations;
    }

    /**
     * Extract US Region Calibration data
     */
    private function extractUSRegionCalibration($tags) {
        $calibration = [];

        $regionSeq = $tags[self::TAG_US_REGION_SEQUENCE]['Value'] ?? [];
        foreach ($regionSeq as $region) {
            $physicalUnitsX = $region[self::TAG_PHYSICAL_UNITS_X]['Value'] ?? 0;
            $physicalUnitsY = $region[self::TAG_PHYSICAL_UNITS_Y]['Value'] ?? 0;
            $physicalDeltaX = $region[self::TAG_PHYSICAL_DELTA_X]['Value'] ?? 0;
            $physicalDeltaY = $region[self::TAG_PHYSICAL_DELTA_Y]['Value'] ?? 0;

            // Convert physical units code to readable format
            $unitsMap = [
                0 => 'None',
                1 => 'Percent',
                2 => 'dB',
                3 => 'cm',
                4 => 'seconds',
                5 => 'hertz',
                6 => 'dB/seconds',
                7 => 'cm/sec',
                8 => 'cm²',
                9 => 'cm²/sec',
                10 => 'cm³',
                11 => 'cm³/sec'
            ];

            $calibration[] = [
                'physicalUnitsX' => $unitsMap[$physicalUnitsX] ?? 'Unknown',
                'physicalUnitsY' => $unitsMap[$physicalUnitsY] ?? 'Unknown',
                'pixelSpacingX' => $physicalDeltaX,
                'pixelSpacingY' => $physicalDeltaY,
                'source' => 'us_region_calibration'
            ];
        }

        return $calibration;
    }

    /**
     * Parse overlay text from rendered image (OCR-like parsing of common patterns)
     */
    private function parseOverlayText($instanceId) {
        $measurements = [];

        // Get simplified tags which might contain measurement data
        $url = "{$this->orthancUrl}/instances/{$instanceId}/simplified-tags";

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => [
                'Authorization: Basic ' . $this->orthancAuth,
                'Accept: application/json'
            ],
            CURLOPT_TIMEOUT => 30
        ]);

        $response = curl_exec($ch);
        curl_close($ch);

        $simplifiedTags = json_decode($response, true) ?? [];

        // Look for measurement data in various text fields
        $textFields = [
            'ImageComments',
            'SeriesDescription',
            'StudyDescription',
            'ContentDescription',
            'AnnotationComment'
        ];

        foreach ($textFields as $field) {
            if (isset($simplifiedTags[$field])) {
                $text = $simplifiedTags[$field];
                $parsed = $this->parseAllMeasurementsFromText($text);
                $measurements = array_merge($measurements, $parsed);
            }
        }

        return $measurements;
    }

    /**
     * Find related Structured Reports in the same study
     */
    private function findRelatedStructuredReports($studyId) {
        $measurements = [];

        // Get study series
        $url = "{$this->orthancUrl}/studies/{$studyId}/series";

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => [
                'Authorization: Basic ' . $this->orthancAuth,
                'Accept: application/json'
            ],
            CURLOPT_TIMEOUT => 30
        ]);

        $response = curl_exec($ch);
        curl_close($ch);

        $seriesList = json_decode($response, true) ?? [];

        foreach ($seriesList as $seriesId) {
            // Get series info
            $seriesUrl = "{$this->orthancUrl}/series/{$seriesId}";
            $ch = curl_init($seriesUrl);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_HTTPHEADER => [
                    'Authorization: Basic ' . $this->orthancAuth,
                    'Accept: application/json'
                ],
                CURLOPT_TIMEOUT => 30
            ]);

            $seriesResponse = curl_exec($ch);
            curl_close($ch);

            $seriesInfo = json_decode($seriesResponse, true);
            $modality = $seriesInfo['MainDicomTags']['Modality'] ?? '';

            // If this is an SR series, extract measurements from it
            if ($modality === 'SR') {
                $instances = $seriesInfo['Instances'] ?? [];
                foreach ($instances as $instanceId) {
                    $tags = $this->getInstanceTags($instanceId);
                    if ($tags) {
                        $srMeasurements = $this->extractFromContentSequence($tags);
                        $measurements = array_merge($measurements, $srMeasurements);
                    }
                }
            }
        }

        return $measurements;
    }

    /**
     * Check if text looks like it contains a measurement
     */
    private function looksLikeMeasurement($text) {
        if (!$text) return false;

        // Patterns that indicate measurements
        $patterns = [
            '/\d+\.?\d*\s*(cm|mm|m|ml|cc|cm2|cm3|cm\/s|m\/s|%|g|kg|weeks|wk|days|d)/i',
            '/\b(length|width|height|diameter|volume|area|thickness|size|dimension)\s*[:=]?\s*\d/i',
            '/\b(BPD|HC|AC|FL|CRL|EFW|LV|RV|LA|RA|IVS|LVPW)\s*[:=]?\s*\d/i',
            '/\d+\s*[xX×]\s*\d+/i', // Dimension format like "5 x 3"
        ];

        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $text)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Parse measurement from text
     */
    private function parseMeasurementText($text) {
        // Try to extract measurement value and unit
        if (preg_match('/(\d+\.?\d*)\s*(cm|mm|m|ml|cc|cm2|cm3|cm\/s|m\/s|%|g|kg)/i', $text, $matches)) {
            $value = floatval($matches[1]);
            $unit = strtolower($matches[2]);

            // Try to identify what's being measured
            $name = $this->identifyMeasurementName($text);

            return [
                'type' => 'parsed',
                'name' => $name,
                'value' => $value,
                'unit' => $this->unitCodes[$unit] ?? $unit,
                'rawText' => $text
            ];
        }

        return null;
    }

    /**
     * Parse all measurements from a text block
     */
    private function parseAllMeasurementsFromText($text) {
        $measurements = [];

        // Split by common delimiters
        $lines = preg_split('/[,;\n\r]+/', $text);

        foreach ($lines as $line) {
            $line = trim($line);
            if ($this->looksLikeMeasurement($line)) {
                $parsed = $this->parseMeasurementText($line);
                if ($parsed) {
                    $measurements[] = $parsed;
                }
            }
        }

        // Also try to extract dimension patterns (e.g., "5.2 x 3.1 x 2.8 cm")
        if (preg_match_all('/(\d+\.?\d*)\s*[xX×]\s*(\d+\.?\d*)(?:\s*[xX×]\s*(\d+\.?\d*))?\s*(cm|mm)/i', $text, $matches, PREG_SET_ORDER)) {
            foreach ($matches as $match) {
                $unit = strtolower($match[4]);
                $measurements[] = [
                    'type' => 'dimensions',
                    'name' => $this->identifyMeasurementName($text) . ' Dimensions',
                    'value' => isset($match[3]) && $match[3]
                        ? "{$match[1]} × {$match[2]} × {$match[3]}"
                        : "{$match[1]} × {$match[2]}",
                    'unit' => $this->unitCodes[$unit] ?? $unit,
                    'dimensions' => [
                        'length' => floatval($match[1]),
                        'width' => floatval($match[2]),
                        'depth' => isset($match[3]) && $match[3] ? floatval($match[3]) : null
                    ],
                    'source' => 'parsed_text'
                ];
            }
        }

        return $measurements;
    }

    /**
     * Identify measurement name from context
     */
    private function identifyMeasurementName($text) {
        $text = strtolower($text);

        $keywords = [
            'liver' => 'Liver',
            'kidney' => 'Kidney',
            'right kidney' => 'Right Kidney',
            'left kidney' => 'Left Kidney',
            'spleen' => 'Spleen',
            'pancreas' => 'Pancreas',
            'gallbladder' => 'Gallbladder',
            'gb' => 'Gallbladder',
            'cbd' => 'Common Bile Duct',
            'common bile duct' => 'Common Bile Duct',
            'aorta' => 'Aorta',
            'thyroid' => 'Thyroid',
            'right lobe' => 'Right Lobe',
            'left lobe' => 'Left Lobe',
            'isthmus' => 'Isthmus',
            'uterus' => 'Uterus',
            'ovary' => 'Ovary',
            'prostate' => 'Prostate',
            'bladder' => 'Bladder',
            'fetus' => 'Fetus',
            'bpd' => 'Biparietal Diameter',
            'hc' => 'Head Circumference',
            'ac' => 'Abdominal Circumference',
            'fl' => 'Femur Length',
            'crl' => 'Crown Rump Length',
            'efw' => 'Estimated Fetal Weight',
            'lv' => 'Left Ventricle',
            'rv' => 'Right Ventricle',
            'la' => 'Left Atrium',
            'ra' => 'Right Atrium',
            'ef' => 'Ejection Fraction',
            'ivs' => 'Interventricular Septum',
        ];

        foreach ($keywords as $key => $name) {
            if (strpos($text, $key) !== false) {
                return $name;
            }
        }

        return 'Measurement';
    }

    /**
     * Consolidate measurements from all sources
     */
    private function consolidateMeasurements($measurements) {
        $consolidated = [];

        // Priority: structured_report > graphic_annotations > text_annotations > parsed_overlay
        $sources = [
            'structured_report',
            'graphic_annotations',
            'text_annotations',
            'parsed_overlay'
        ];

        foreach ($sources as $source) {
            if (!empty($measurements[$source])) {
                foreach ($measurements[$source] as $m) {
                    // Use name as key to avoid duplicates
                    $key = strtolower($m['name'] ?? 'unknown');
                    if (!isset($consolidated[$key])) {
                        $consolidated[$key] = $m;
                    }
                }
            }
        }

        return array_values($consolidated);
    }

    /**
     * Categorize measurements for display
     */
    private function categorizeMeasurements($measurements) {
        $categories = [
            'obstetric' => [],
            'abdominal' => [],
            'thyroid' => [],
            'cardiac' => [],
            'vascular' => [],
            'generic' => []
        ];

        foreach ($measurements as $m) {
            $category = $m['category'] ?? 'generic';
            if (!isset($categories[$category])) {
                $category = 'generic';
            }
            $categories[$category][] = $m;
        }

        // Remove empty categories
        return array_filter($categories, function($items) {
            return !empty($items);
        });
    }
}

// Handle request
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $instanceId = $_GET['instanceId'] ?? null;
    $studyId = $_GET['studyId'] ?? null;

    if (!$instanceId) {
        echo json_encode(['success' => false, 'error' => 'Instance ID required']);
        exit;
    }

    $extractor = new DicomMeasurementExtractor();
    $result = $extractor->extractMeasurements($instanceId, $studyId);

    echo json_encode($result, JSON_PRETTY_PRINT);

} elseif ($method === 'POST') {
    // Batch extraction for multiple instances
    $input = json_decode(file_get_contents('php://input'), true);
    $instanceIds = $input['instanceIds'] ?? [];
    $studyId = $input['studyId'] ?? null;

    if (empty($instanceIds)) {
        echo json_encode(['success' => false, 'error' => 'Instance IDs required']);
        exit;
    }

    $extractor = new DicomMeasurementExtractor();
    $results = [];

    foreach ($instanceIds as $instanceId) {
        $results[$instanceId] = $extractor->extractMeasurements($instanceId, $studyId);
    }

    echo json_encode([
        'success' => true,
        'results' => $results
    ], JSON_PRETTY_PRINT);

} else {
    echo json_encode(['success' => false, 'error' => 'Invalid method']);
}
