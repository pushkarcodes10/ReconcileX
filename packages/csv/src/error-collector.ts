import { RowError } from './types';

export class RowErrorCollector {
  private readonly errors: RowError[] = [];

  public add(error: RowError): void {
    this.errors.push(error);
  }

  public addAll(errors: RowError[]): void {
    this.errors.push(...errors);
  }

  public getErrors(): RowError[] {
    return [...this.errors];
  }

  public get count(): number {
    return this.errors.length;
  }

  public clear(): void {
    this.errors.length = 0;
  }
}
