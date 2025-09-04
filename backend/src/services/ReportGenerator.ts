import { AnalysisResults, StoredAnalysisResults, Recommendation } from '../../../shared/types';
import PDFDocument from 'pdfkit';
import { createObjectCsvWriter } from 'csv-writer';
import { promises as fs } from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

export interface ReportOptions {
  includeDetails: boolean;
  customNotes?: string;
  branding?: {
    companyName?: string;
    logo?: string;
    colors?: {
      primary?: string;
      secondary?: string;
    };
  };
}

export interface ExportResult {
  success: boolean;
  filePath?: string;
  error?: string;
  metadata?: {
    format: string;
    fileSize: number;
    generatedAt: Date;
  };
}

/**
 * ReportGenerator handles the creation of analysis reports in multiple formats
 * Supports PDF, CSV, and JSON exports with customizable templates and branding
 */
export class ReportGenerator {
  private readonly outputDir: string;

  constructor(outputDir: string = './reports') {
    this.outputDir = outputDir;
  }

  /**
   * Generates a PDF report with charts and visualizations
   * @param results Analysis results to include in the report
   * @param options Report generation options
   * @returns Promise resolving to export result
   */
  async generatePDFReport(
    results: AnalysisResults[],
    options: ReportOptions = { includeDetails: true }
  ): Promise<ExportResult> {
    try {
      await this.ensureOutputDirectory();
      logger.info(`Generating PDF report for ${results.length} results`);
      
      const fileName = `seo-geo-report-${Date.now()}.pdf`;
      const filePath = path.join(this.outputDir, fileName);
      
      const doc = new PDFDocument({ margin: 50 });
      const fs = require('fs');
      const stream = doc.pipe(fs.createWriteStream(filePath));

      // Add report header
      this.addPDFHeader(doc, options);
      
      // Add executive summary
      this.addExecutiveSummary(doc, results);
      
      // Add detailed results for each URL
      for (let i = 0; i < results.length; i++) {
        if (i > 0) doc.addPage();
        this.addDetailedAnalysis(doc, results[i], options);
      }
      
      // Add recommendations summary
      doc.addPage();
      this.addRecommendationsSummary(doc, results);
      
      // Add custom notes if provided
      if (options.customNotes) {
        doc.addPage();
        this.addCustomNotes(doc, options.customNotes);
      }

      doc.end();
      
      // Wait for PDF generation to complete
      await new Promise((resolve, reject) => {
        stream.on('finish', resolve);
        stream.on('error', reject);
      });

      const stats = await fs.stat(filePath);
      
      logger.info(`PDF report generated successfully: ${fileName}`);
      
      return {
        success: true,
        filePath,
        metadata: {
          format: 'PDF',
          fileSize: stats.size,
          generatedAt: new Date()
        }
      };
    } catch (error) {
      logger.error('Error generating PDF report:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Generates a CSV export for data analysis and tracking
   * @param results Analysis results to export
   * @param options Report generation options
   * @returns Promise resolving to export result
   */
  async generateCSVReport(
    results: AnalysisResults[],
    options: ReportOptions = { includeDetails: true }
  ): Promise<ExportResult> {
    try {
      await this.ensureOutputDirectory();
      logger.info(`Generating CSV report for ${results.length} results`);
      
      const fileName = `seo-geo-data-${Date.now()}.csv`;
      const filePath = path.join(this.outputDir, fileName);
      
      const csvData = this.prepareCSVData(results, options);
      const csvWriter = createObjectCsvWriter({
        path: filePath,
        header: this.getCSVHeaders(options)
      });

      await csvWriter.writeRecords(csvData);
      
      const stats = await fs.stat(filePath);
      
      logger.info(`CSV report generated successfully: ${fileName}`);
      
      return {
        success: true,
        filePath,
        metadata: {
          format: 'CSV',
          fileSize: stats.size,
          generatedAt: new Date()
        }
      };
    } catch (error) {
      logger.error('Error generating CSV report:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Generates a JSON export for API integration
   * @param results Analysis results to export
   * @param options Report generation options
   * @returns Promise resolving to export result
   */
  async generateJSONReport(
    results: AnalysisResults[],
    options: ReportOptions = { includeDetails: true }
  ): Promise<ExportResult> {
    try {
      await this.ensureOutputDirectory();
      logger.info(`Generating JSON report for ${results.length} results`);
      
      const fileName = `seo-geo-export-${Date.now()}.json`;
      const filePath = path.join(this.outputDir, fileName);
      
      const exportData = {
        metadata: {
          exportedAt: new Date().toISOString(),
          version: '1.0.0',
          totalResults: results.length,
          includeDetails: options.includeDetails,
          customNotes: options.customNotes
        },
        summary: this.generateSummary(results),
        results: options.includeDetails ? results : this.getSimplifiedResults(results)
      };

      await fs.writeFile(filePath, JSON.stringify(exportData, null, 2), 'utf8');
      
      const stats = await fs.stat(filePath);
      
      logger.info(`JSON report generated successfully: ${fileName}`);
      
      return {
        success: true,
        filePath,
        metadata: {
          format: 'JSON',
          fileSize: stats.size,
          generatedAt: new Date()
        }
      };
    } catch (error) {
      logger.error('Error generating JSON report:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Generates reports in multiple formats simultaneously
   * @param results Analysis results to export
   * @param formats Array of formats to generate
   * @param options Report generation options
   * @returns Promise resolving to array of export results
   */
  async generateMultiFormatReport(
    results: AnalysisResults[],
    formats: ('pdf' | 'csv' | 'json')[],
    options: ReportOptions = { includeDetails: true }
  ): Promise<ExportResult[]> {
    try {
      logger.info(`Generating multi-format report in ${formats.join(', ')} formats`);
      
      const promises = formats.map(format => {
        switch (format) {
          case 'pdf':
            return this.generatePDFReport(results, options);
          case 'csv':
            return this.generateCSVReport(results, options);
          case 'json':
            return this.generateJSONReport(results, options);
          default:
            throw new Error(`Unsupported format: ${format}`);
        }
      });

      const exportResults = await Promise.all(promises);
      
      logger.info(`Multi-format report generation completed`);
      return exportResults;
    } catch (error) {
      logger.error('Error generating multi-format report:', error);
      throw error;
    }
  }

  // Private helper methods for PDF generation

  private addPDFHeader(doc: PDFKit.PDFDocument, options: ReportOptions): void {
    const branding = options.branding;
    const primaryColor = branding?.colors?.primary || '#2563eb';
    
    // Add company name or default title
    doc.fontSize(24)
       .fillColor(primaryColor)
       .text(branding?.companyName || 'SEO & GEO Health Report', 50, 50);
    
    // Add generation date
    doc.fontSize(12)
       .fillColor('#666666')
       .text(`Generated on: ${new Date().toLocaleDateString()}`, 50, 85);
    
    // Add separator line
    doc.moveTo(50, 110)
       .lineTo(550, 110)
       .strokeColor(primaryColor)
       .stroke();
  }

  private addExecutiveSummary(doc: PDFKit.PDFDocument, results: AnalysisResults[]): void {
    const summary = this.generateSummary(results);
    
    doc.fontSize(18)
       .fillColor('#000000')
       .text('Executive Summary', 50, 130);
    
    let yPosition = 160;
    
    // Overall statistics
    doc.fontSize(12)
       .text(`Total URLs Analyzed: ${results.length}`, 50, yPosition);
    yPosition += 20;
    
    doc.text(`Average Overall Score: ${summary.averageScore.toFixed(1)}/100`, 50, yPosition);
    yPosition += 20;
    
    doc.text(`Average SEO Score: ${summary.averageSEOScore.toFixed(1)}/100`, 50, yPosition);
    yPosition += 20;
    
    doc.text(`Average GEO Score: ${summary.averageGEOScore.toFixed(1)}/100`, 50, yPosition);
    yPosition += 40;
    
    // Top issues
    doc.fontSize(14)
       .text('Most Common Issues:', 50, yPosition);
    yPosition += 25;
    
    summary.topIssues.slice(0, 5).forEach((issue, index) => {
      doc.fontSize(11)
         .text(`${index + 1}. ${issue}`, 70, yPosition);
      yPosition += 18;
    });
  }

  private addDetailedAnalysis(doc: PDFKit.PDFDocument, result: AnalysisResults, options: ReportOptions): void {
    doc.fontSize(16)
       .fillColor('#000000')
       .text(`Analysis: ${result.url}`, 50, 50);
    
    let yPosition = 80;
    
    // Scores section
    doc.fontSize(14)
       .text('Scores:', 50, yPosition);
    yPosition += 25;
    
    doc.fontSize(12)
       .text(`Overall Score: ${result.overallScore}/100`, 70, yPosition);
    yPosition += 18;
    
    doc.text(`SEO Score: ${result.seoScore.overall}/100`, 70, yPosition);
    yPosition += 18;
    
    doc.text(`GEO Score: ${result.geoScore.overall}/100`, 70, yPosition);
    yPosition += 30;
    
    if (options.includeDetails) {
      // SEO Details
      doc.fontSize(14)
         .text('SEO Analysis Details:', 50, yPosition);
      yPosition += 25;
      
      doc.fontSize(11)
         .text(`Technical SEO: ${result.seoScore.technical}/100`, 70, yPosition);
      yPosition += 15;
      
      doc.text(`Content SEO: ${result.seoScore.content}/100`, 70, yPosition);
      yPosition += 15;
      
      doc.text(`Structure: ${result.seoScore.structure}/100`, 70, yPosition);
      yPosition += 25;
      
      // GEO Details
      doc.fontSize(14)
         .text('GEO Analysis Details:', 50, yPosition);
      yPosition += 25;
      
      doc.fontSize(11)
         .text(`Readability: ${result.geoScore.readability}/100`, 70, yPosition);
      yPosition += 15;
      
      doc.text(`Credibility: ${result.geoScore.credibility}/100`, 70, yPosition);
      yPosition += 15;
      
      doc.text(`Completeness: ${result.geoScore.completeness}/100`, 70, yPosition);
      yPosition += 15;
      
      doc.text(`Structured Data: ${result.geoScore.structuredData}/100`, 70, yPosition);
      yPosition += 30;
    }
    
    // Top recommendations
    doc.fontSize(14)
       .text('Top Recommendations:', 50, yPosition);
    yPosition += 25;
    
    const topRecs = result.recommendations
      .filter(rec => rec.priority === 'High')
      .slice(0, 3);
    
    topRecs.forEach((rec, index) => {
      doc.fontSize(11)
         .text(`${index + 1}. ${rec.title}`, 70, yPosition);
      yPosition += 15;
      
      doc.fontSize(10)
         .fillColor('#666666')
         .text(rec.description, 90, yPosition, { width: 450 });
      yPosition += 25;
      
      doc.fillColor('#000000');
    });
  }

  private addRecommendationsSummary(doc: PDFKit.PDFDocument, results: AnalysisResults[]): void {
    doc.fontSize(18)
       .fillColor('#000000')
       .text('Recommendations Summary', 50, 50);
    
    const allRecommendations = results.flatMap(r => r.recommendations);
    const groupedRecs = this.groupRecommendationsByTitle(allRecommendations);
    
    let yPosition = 90;
    
    Object.entries(groupedRecs)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 10)
      .forEach(([title, data]) => {
        doc.fontSize(12)
           .text(`${title} (${data.count} occurrences)`, 50, yPosition);
        yPosition += 15;
        
        doc.fontSize(10)
           .fillColor('#666666')
           .text(data.recommendation.description, 70, yPosition, { width: 450 });
        yPosition += 25;
        
        doc.fillColor('#000000');
      });
  }

  private addCustomNotes(doc: PDFKit.PDFDocument, notes: string): void {
    doc.fontSize(18)
       .fillColor('#000000')
       .text('Custom Notes', 50, 50);
    
    doc.fontSize(12)
       .text(notes, 50, 90, { width: 500 });
  }

  // Private helper methods for CSV generation

  private prepareCSVData(results: AnalysisResults[], options: ReportOptions): any[] {
    return results.map(result => {
      const baseData = {
        url: result.url,
        timestamp: result.timestamp.toISOString(),
        overallScore: result.overallScore,
        seoScore: result.seoScore.overall,
        geoScore: result.geoScore.overall,
        highPriorityRecommendations: result.recommendations.filter(r => r.priority === 'High').length,
        totalRecommendations: result.recommendations.length
      };

      if (options.includeDetails) {
        return {
          ...baseData,
          technicalSEO: result.seoScore.technical,
          contentSEO: result.seoScore.content,
          structureSEO: result.seoScore.structure,
          readabilityGEO: result.geoScore.readability,
          credibilityGEO: result.geoScore.credibility,
          completenessGEO: result.geoScore.completeness,
          structuredDataGEO: result.geoScore.structuredData,
          pageSpeed: result.seoScore.details.pageSpeed,
          mobileResponsive: result.seoScore.details.mobileResponsive,
          titleTagScore: result.seoScore.details.titleTag.score,
          metaDescriptionScore: result.seoScore.details.metaDescription.score,
          internalLinks: result.seoScore.details.internalLinks,
          loadTime: result.technicalDetails.loadTime,
          pageSize: result.technicalDetails.pageSize,
          statusCode: result.technicalDetails.statusCode
        };
      }

      return baseData;
    });
  }

  private getCSVHeaders(options: ReportOptions): Array<{ id: string; title: string }> {
    const baseHeaders = [
      { id: 'url', title: 'URL' },
      { id: 'timestamp', title: 'Analysis Date' },
      { id: 'overallScore', title: 'Overall Score' },
      { id: 'seoScore', title: 'SEO Score' },
      { id: 'geoScore', title: 'GEO Score' },
      { id: 'highPriorityRecommendations', title: 'High Priority Issues' },
      { id: 'totalRecommendations', title: 'Total Recommendations' }
    ];

    if (options.includeDetails) {
      return [
        ...baseHeaders,
        { id: 'technicalSEO', title: 'Technical SEO' },
        { id: 'contentSEO', title: 'Content SEO' },
        { id: 'structureSEO', title: 'Structure SEO' },
        { id: 'readabilityGEO', title: 'Readability GEO' },
        { id: 'credibilityGEO', title: 'Credibility GEO' },
        { id: 'completenessGEO', title: 'Completeness GEO' },
        { id: 'structuredDataGEO', title: 'Structured Data GEO' },
        { id: 'pageSpeed', title: 'Page Speed' },
        { id: 'mobileResponsive', title: 'Mobile Responsive' },
        { id: 'titleTagScore', title: 'Title Tag Score' },
        { id: 'metaDescriptionScore', title: 'Meta Description Score' },
        { id: 'internalLinks', title: 'Internal Links' },
        { id: 'loadTime', title: 'Load Time (ms)' },
        { id: 'pageSize', title: 'Page Size (bytes)' },
        { id: 'statusCode', title: 'Status Code' }
      ];
    }

    return baseHeaders;
  }

  // Private helper methods for data processing

  private generateSummary(results: AnalysisResults[]): {
    averageScore: number;
    averageSEOScore: number;
    averageGEOScore: number;
    topIssues: string[];
  } {
    if (results.length === 0) {
      return {
        averageScore: 0,
        averageSEOScore: 0,
        averageGEOScore: 0,
        topIssues: []
      };
    }

    const averageScore = results.reduce((sum, r) => sum + r.overallScore, 0) / results.length;
    const averageSEOScore = results.reduce((sum, r) => sum + r.seoScore.overall, 0) / results.length;
    const averageGEOScore = results.reduce((sum, r) => sum + r.geoScore.overall, 0) / results.length;

    // Get most common issues
    const issueCount: Record<string, number> = {};
    results.forEach(result => {
      result.recommendations.forEach(rec => {
        issueCount[rec.title] = (issueCount[rec.title] || 0) + 1;
      });
    });

    const topIssues = Object.entries(issueCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([issue]) => issue);

    return {
      averageScore,
      averageSEOScore,
      averageGEOScore,
      topIssues
    };
  }

  private getSimplifiedResults(results: AnalysisResults[]): any[] {
    return results.map(result => ({
      url: result.url,
      timestamp: result.timestamp,
      overallScore: result.overallScore,
      seoScore: result.seoScore.overall,
      geoScore: result.geoScore.overall,
      topRecommendations: result.recommendations
        .filter(rec => rec.priority === 'High')
        .slice(0, 3)
        .map(rec => ({
          title: rec.title,
          category: rec.category,
          impact: rec.impact
        }))
    }));
  }

  private groupRecommendationsByTitle(recommendations: Recommendation[]): Record<string, { recommendation: Recommendation; count: number }> {
    const grouped: Record<string, { recommendation: Recommendation; count: number }> = {};
    
    recommendations.forEach(rec => {
      if (!grouped[rec.title]) {
        grouped[rec.title] = { recommendation: rec, count: 0 };
      }
      grouped[rec.title].count++;
    });

    return grouped;
  }

  private async ensureOutputDirectory(): Promise<void> {
    try {
      await fs.access(this.outputDir);
    } catch {
      await fs.mkdir(this.outputDir, { recursive: true });
      logger.info(`Created output directory: ${this.outputDir}`);
    }
  }

  /**
   * Cleans up old report files (older than specified days)
   * @param daysOld Number of days after which files should be deleted
   */
  async cleanupOldReports(daysOld: number = 30): Promise<void> {
    try {
      const files = await fs.readdir(this.outputDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      for (const file of files) {
        const filePath = path.join(this.outputDir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime < cutoffDate) {
          await fs.unlink(filePath);
          logger.info(`Deleted old report file: ${file}`);
        }
      }
    } catch (error) {
      logger.error('Error cleaning up old reports:', error);
    }
  }
}