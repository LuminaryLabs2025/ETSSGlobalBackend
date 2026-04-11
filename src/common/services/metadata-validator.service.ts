import { Injectable, BadRequestException } from '@nestjs/common';
import {
  UserTypeMetadata,
  UserTypeField,
} from '../../database/entities/user-type.entity';

/**
 * Validates `extra_fields` against user-type metadata.
 * Canonical keys in metadata are **snake_case**; each field also accepts the
 * camelCase alias so older DB metadata and new clients stay compatible.
 */
@Injectable()
export class MetadataValidatorService {
  validate(
    metadata: UserTypeMetadata | null,
    data: Record<string, any> | null,
  ): Record<string, any> {
    if (!metadata?.fields?.length) {
      return data || {};
    }

    const validated: Record<string, any> = {};
    const errors: string[] = [];

    for (const field of metadata.fields) {
      let value = this.pickRawValue(data, field.name);
      if (field.type === 'number' && value !== undefined && value !== null) {
        value = this.coerceNumber(value);
      }

      if (field.required && !field.autoPopulated && this.isEmpty(value)) {
        errors.push(`${field.label || field.name} is required`);
        continue;
      }

      if (field.autoPopulated && field.autoPopulatedValue) {
        validated[field.name] = field.autoPopulatedValue;
        continue;
      }

      if (this.isEmpty(value)) {
        continue;
      }

      const typeError = this.validateType(field, value);
      if (typeError) {
        errors.push(typeError);
        continue;
      }

      if (
        (field.type === 'select' || field.type === 'multi-select') &&
        field.options?.length
      ) {
        const optionError = this.validateOptions(field, value);
        if (optionError) {
          errors.push(optionError);
          continue;
        }
      }

      validated[field.name] = value;
    }

    if (errors.length > 0) {
      throw new BadRequestException({
        message: 'Validation failed for user type fields',
        errors,
      });
    }

    return validated;
  }

  private isEmpty(value: any): boolean {
    if (value === undefined || value === null || value === '') return true;
    if (Array.isArray(value) && value.length === 0) return true;
    return false;
  }

  private validateType(field: UserTypeField, value: any): string | null {
    const label = field.label || field.name;

    switch (field.type) {
      case 'number':
        if (typeof value !== 'number' && isNaN(Number(value))) {
          return `${label} must be a number`;
        }
        break;

      case 'email': {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (typeof value !== 'string' || !emailRegex.test(value)) {
          return `${label} must be a valid email`;
        }
        break;
      }

      case 'phone':
        if (typeof value !== 'string') {
          return `${label} must be a string`;
        }
        break;

      case 'multi-select':
        if (!Array.isArray(value)) {
          return `${label} must be an array`;
        }
        break;

      case 'string':
      case 'text':
      case 'select':
        if (typeof value !== 'string') {
          return `${label} must be a string`;
        }
        break;
    }

    return null;
  }

  private validateOptions(field: UserTypeField, value: any): string | null {
    const label = field.label || field.name;
    const validValues = field.options!.map((o) => o.value);

    if (field.type === 'multi-select') {
      const invalid = (value as string[]).filter(
        (v) => !validValues.includes(v),
      );
      if (invalid.length > 0) {
        return `${label}: invalid options [${invalid.join(', ')}]`;
      }
    } else {
      if (!validValues.includes(value)) {
        return `${label}: invalid option "${value}"`;
      }
    }

    return null;
  }

  /**
   * Reads a value using the metadata key first, then the opposite casing convention.
   * Handles DB metadata still on camelCase `name` while clients send snake_case (or the reverse).
   */
  private pickRawValue(
    data: Record<string, any> | null,
    key: string,
  ): any {
    if (!data) return undefined;
    if (this.hasOwnValue(data, key)) return data[key];
    const camel = this.snakeToCamel(key);
    if (camel !== key && this.hasOwnValue(data, camel)) return data[camel];
    const snake = this.camelToSnake(key);
    if (snake !== key && this.hasOwnValue(data, snake)) return data[snake];
    return undefined;
  }

  private hasOwnValue(data: Record<string, any>, key: string): boolean {
    return (
      Object.prototype.hasOwnProperty.call(data, key) &&
      data[key] !== undefined
    );
  }

  private snakeToCamel(s: string): string {
    return s.replace(/_([a-z])/gi, (_, c: string) => c.toUpperCase());
  }

  private camelToSnake(s: string): string {
    return s
      .replace(/([A-Z])/g, (g) => '_' + g.toLowerCase())
      .replace(/^_/, '');
  }

  private coerceNumber(value: any): number | any {
    if (typeof value === 'number' && !Number.isNaN(value)) return value;
    if (typeof value === 'string' && value.trim() !== '' && !isNaN(Number(value))) {
      return Number(value);
    }
    return value;
  }
}
