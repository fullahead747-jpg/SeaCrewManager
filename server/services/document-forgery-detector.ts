import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';

export interface ForgeryAnalysisResult {
    riskScore: number; // 0-100, higher = more suspicious
    riskLevel: 'low' | 'medium' | 'high';
    warnings: string[];
    details: {
        imageQuality: ImageQualityAnalysis;
        metadata: MetadataAnalysis;
        visualConsistency: VisualConsistencyAnalysis;
    };
}

export interface ImageQualityAnalysis {
    resolution: { width: number; height: number };
    dpi?: number;
    compressionArtifacts: boolean;
    noiseLevel: 'low' | 'medium' | 'high';
    suspiciousPatterns: string[];
}

export interface MetadataAnalysis {
    creationDate?: string;
    modificationDate?: string;
    software?: string;
    suspicious: boolean;
    reasons: string[];
}

export interface VisualConsistencyAnalysis {
    fontConsistency: boolean;
    alignmentIssues: boolean;
    colorAnomalies: boolean;
    edgeAnomalies: boolean;
    suspiciousRegions: string[];
}

export class DocumentForgeryDetector {
    /**
     * Main entry point for forgery detection
     */
    async detectForgery(filePath: string): Promise<ForgeryAnalysisResult> {
        try {
            console.log(`[FORGERY-DETECTION] Analyzing document: ${filePath}`);

            // Run all analysis in parallel
            const [imageQuality, metadata, visualConsistency] = await Promise.all([
                this.analyzeImageQuality(filePath),
                this.extractMetadata(filePath),
                this.checkVisualConsistency(filePath)
            ]);

            // Calculate overall risk score
            const riskScore = this.calculateRiskScore(imageQuality, metadata, visualConsistency);
            const riskLevel = this.getRiskLevel(riskScore);

            // Generate warnings
            const warnings = this.generateWarnings(imageQuality, metadata, visualConsistency, riskLevel);

            console.log(`[FORGERY-DETECTION] Risk Score: ${riskScore}/100 (${riskLevel})`);

            return {
                riskScore,
                riskLevel,
                warnings,
                details: {
                    imageQuality,
                    metadata,
                    visualConsistency
                }
            };
        } catch (error) {
            console.error('[FORGERY-DETECTION] Error:', error);
            // Return neutral result on error
            return {
                riskScore: 50,
                riskLevel: 'medium',
                warnings: ['Unable to complete full forgery analysis'],
                details: {
                    imageQuality: {
                        resolution: { width: 0, height: 0 },
                        compressionArtifacts: false,
                        noiseLevel: 'medium',
                        suspiciousPatterns: []
                    },
                    metadata: {
                        suspicious: false,
                        reasons: []
                    },
                    visualConsistency: {
                        fontConsistency: true,
                        alignmentIssues: false,
                        colorAnomalies: false,
                        edgeAnomalies: false,
                        suspiciousRegions: []
                    }
                }
            };
        }
    }

    /**
     * Analyze image quality for manipulation signs
     */
    private async analyzeImageQuality(filePath: string): Promise<ImageQualityAnalysis> {
        const suspiciousPatterns: string[] = [];

        try {
            const image = sharp(filePath);
            const metadata = await image.metadata();

            const resolution = {
                width: metadata.width || 0,
                height: metadata.height || 0
            };

            // Check resolution - too low or unusually high can be suspicious
            if (resolution.width < 800 || resolution.height < 600) {
                suspiciousPatterns.push('Low resolution scan (< 800x600)');
            }

            // Check for extreme resolutions that might indicate digital creation
            if (resolution.width > 5000 || resolution.height > 5000) {
                suspiciousPatterns.push('Unusually high resolution for a scan');
            }

            // Get image statistics for noise analysis
            const stats = await image.stats();

            // Analyze noise level based on standard deviation
            let noiseLevel: 'low' | 'medium' | 'high' = 'medium';
            if (stats.channels && stats.channels.length > 0) {
                const avgStdDev = stats.channels.reduce((sum, ch) => sum + ch.stdev, 0) / stats.channels.length;

                if (avgStdDev < 20) {
                    noiseLevel = 'low';
                    suspiciousPatterns.push('Unusually low noise - possible digital creation or heavy filtering');
                } else if (avgStdDev > 60) {
                    noiseLevel = 'high';
                    suspiciousPatterns.push('High noise level - poor scan quality');
                }
            }

            // Check compression artifacts (JPEG quality)
            const compressionArtifacts = metadata.format === 'jpeg' &&
                (metadata.density || 72) < 150;

            if (compressionArtifacts) {
                suspiciousPatterns.push('Low quality JPEG compression detected');
            }

            // Check DPI
            const dpi = metadata.density;
            if (dpi && dpi < 150) {
                suspiciousPatterns.push(`Low DPI (${dpi}) - may affect OCR accuracy`);
            }

            return {
                resolution,
                dpi,
                compressionArtifacts,
                noiseLevel,
                suspiciousPatterns
            };
        } catch (error) {
            console.error('[IMAGE-QUALITY] Analysis error:', error);
            return {
                resolution: { width: 0, height: 0 },
                compressionArtifacts: false,
                noiseLevel: 'medium',
                suspiciousPatterns: ['Unable to analyze image quality']
            };
        }
    }

    /**
     * Extract and validate document metadata
     */
    private async extractMetadata(filePath: string): Promise<MetadataAnalysis> {
        const reasons: string[] = [];
        let suspicious = false;

        try {
            const stats = fs.statSync(filePath);
            const ext = path.extname(filePath).toLowerCase();

            // Get file timestamps
            const creationDate = stats.birthtime.toISOString();
            const modificationDate = stats.mtime.toISOString();

            // Check if file was modified after creation (suspicious for scans)
            const timeDiff = stats.mtime.getTime() - stats.birthtime.getTime();
            if (timeDiff > 60000) { // More than 1 minute
                reasons.push('File was modified after creation');
                suspicious = true;
            }

            // Check file size - extremely small files might be suspicious
            if (stats.size < 50000) { // Less than 50KB
                reasons.push('Unusually small file size for a document scan');
                suspicious = true;
            }

            // For PDFs, we could extract more metadata, but keeping it simple for now
            let software: string | undefined;

            if (ext === '.pdf') {
                // PDF metadata extraction would require pdf-parse or similar
                // For now, just note it's a PDF
                software = 'PDF';
            } else if (['.jpg', '.jpeg', '.png'].includes(ext)) {
                // Image metadata
                const image = sharp(filePath);
                const metadata = await image.metadata();

                // Check for EXIF data
                if (metadata.exif) {
                    // Presence of EXIF might indicate photo vs scan
                    reasons.push('EXIF data present - may be a photo rather than scan');
                }
            }

            // Check creation date - if it's very recent, might be suspicious
            const now = new Date();
            const fileAge = now.getTime() - stats.birthtime.getTime();
            const oneHour = 60 * 60 * 1000;

            if (fileAge < oneHour) {
                // File created very recently - not necessarily suspicious for uploads
                // but worth noting
            }

            return {
                creationDate,
                modificationDate,
                software,
                suspicious,
                reasons
            };
        } catch (error) {
            console.error('[METADATA] Extraction error:', error);
            return {
                suspicious: false,
                reasons: ['Unable to extract metadata']
            };
        }
    }

    /**
     * Check visual consistency for signs of tampering
     */
    private async checkVisualConsistency(filePath: string): Promise<VisualConsistencyAnalysis> {
        const suspiciousRegions: string[] = [];

        try {
            const image = sharp(filePath);
            const metadata = await image.metadata();

            // Convert to grayscale for edge detection
            const edges = await image
                .greyscale()
                .normalise()
                .toBuffer();

            // Analyze color distribution
            const stats = await image.stats();

            let colorAnomalies = false;
            let fontConsistency = true;
            let alignmentIssues = false;
            let edgeAnomalies = false;

            // Check for unusual color distributions
            if (stats.channels && stats.channels.length >= 3) {
                const [r, g, b] = stats.channels;

                // Check if colors are too uniform (might indicate digital creation)
                const colorVariance = Math.abs(r.mean - g.mean) + Math.abs(g.mean - b.mean) + Math.abs(r.mean - b.mean);

                if (colorVariance < 5) {
                    colorAnomalies = true;
                    suspiciousRegions.push('Unusually uniform color distribution');
                }

                // Check for extreme color shifts
                if (colorVariance > 100) {
                    colorAnomalies = true;
                    suspiciousRegions.push('Extreme color variations detected');
                }
            }

            // Check image dimensions for common document sizes
            const width = metadata.width || 0;
            const height = metadata.height || 0;
            const aspectRatio = width / height;

            // Common document aspect ratios: A4 (1.414), Letter (1.294), Passport (1.414)
            const commonRatios = [1.294, 1.414, 1.5];
            const isCommonRatio = commonRatios.some(ratio =>
                Math.abs(aspectRatio - ratio) < 0.1
            );

            if (!isCommonRatio && aspectRatio !== 0) {
                alignmentIssues = true;
                suspiciousRegions.push(`Unusual aspect ratio: ${aspectRatio.toFixed(2)}`);
            }

            // Note: Advanced edge detection and font analysis would require more sophisticated
            // image processing libraries. For now, we're doing basic checks.

            return {
                fontConsistency,
                alignmentIssues,
                colorAnomalies,
                edgeAnomalies,
                suspiciousRegions
            };
        } catch (error) {
            console.error('[VISUAL-CONSISTENCY] Analysis error:', error);
            return {
                fontConsistency: true,
                alignmentIssues: false,
                colorAnomalies: false,
                edgeAnomalies: false,
                suspiciousRegions: ['Unable to analyze visual consistency']
            };
        }
    }

    /**
     * Calculate overall risk score
     */
    private calculateRiskScore(
        imageQuality: ImageQualityAnalysis,
        metadata: MetadataAnalysis,
        visualConsistency: VisualConsistencyAnalysis
    ): number {
        let score = 0;

        // Image quality factors (max 40 points)
        score += imageQuality.suspiciousPatterns.length * 8;
        if (imageQuality.compressionArtifacts) score += 10;
        if (imageQuality.noiseLevel === 'low') score += 5;
        if (imageQuality.noiseLevel === 'high') score += 5;

        // Metadata factors (max 30 points)
        if (metadata.suspicious) score += 15;
        score += metadata.reasons.length * 5;

        // Visual consistency factors (max 30 points)
        if (!visualConsistency.fontConsistency) score += 10;
        if (visualConsistency.alignmentIssues) score += 5;
        if (visualConsistency.colorAnomalies) score += 10;
        if (visualConsistency.edgeAnomalies) score += 10;
        score += visualConsistency.suspiciousRegions.length * 3;

        // Cap at 100
        return Math.min(100, score);
    }

    /**
     * Get risk level from score
     */
    private getRiskLevel(score: number): 'low' | 'medium' | 'high' {
        if (score < 30) return 'low';
        if (score < 60) return 'medium';
        return 'high';
    }

    /**
     * Generate user-facing warnings
     */
    private generateWarnings(
        imageQuality: ImageQualityAnalysis,
        metadata: MetadataAnalysis,
        visualConsistency: VisualConsistencyAnalysis,
        riskLevel: 'low' | 'medium' | 'high'
    ): string[] {
        const warnings: string[] = [];

        if (riskLevel === 'high') {
            warnings.push('⚠️ HIGH RISK: This document shows multiple signs of potential tampering or forgery.');
        } else if (riskLevel === 'medium') {
            warnings.push('⚠️ MEDIUM RISK: This document has some suspicious characteristics. Please review carefully.');
        }

        // Add specific warnings
        if (imageQuality.suspiciousPatterns.length > 0) {
            warnings.push(...imageQuality.suspiciousPatterns.map(p => `Image Quality: ${p}`));
        }

        if (metadata.suspicious && metadata.reasons.length > 0) {
            warnings.push(...metadata.reasons.map(r => `Metadata: ${r}`));
        }

        if (visualConsistency.suspiciousRegions.length > 0) {
            warnings.push(...visualConsistency.suspiciousRegions.map(r => `Visual Analysis: ${r}`));
        }

        // If no warnings but medium/high risk, add generic warning
        if (warnings.length === 0 && riskLevel !== 'low') {
            warnings.push('Document analysis detected potential issues. Manual review recommended.');
        }

        return warnings;
    }
}

export const documentForgeryDetector = new DocumentForgeryDetector();
