import { IsOptional, IsDateString, IsString } from 'class-validator';

export enum ReportType {
  CRM_FUNNEL = 'CRM_FUNNEL',
  DEAL_PERFORMANCE = 'DEAL_PERFORMANCE',
  CONTACT_GROWTH = 'CONTACT_GROWTH',
  PROPERTY_STATUS = 'PROPERTY_STATUS',
  FINANCIAL_SUMMARY = 'FINANCIAL_SUMMARY',
  MARKETING_ROI = 'MARKETING_ROI',
  AUTOMATION_STATS = 'AUTOMATION_STATS',
  ACTIVITY_HEATMAP = 'ACTIVITY_HEATMAP',
}

export class ReportFilterDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  groupBy?: string; // day, week, month

  @IsOptional()
  @IsString()
  pipelineId?: string;
}
