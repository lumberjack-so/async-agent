/**
 * User VM Schema Validation Tests
 *
 * This schema SHOULD contain encrypted credentials.
 * Tests verify proper encryption markers and security documentation.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

describe('User VM Schema', () => {
  let schemaContent: string;

  beforeAll(() => {
    const schemaPath = join(__dirname, '..', 'prisma', 'schema.prisma');
    schemaContent = readFileSync(schemaPath, 'utf-8');
  });

  describe('Security Documentation', () => {
    it('should contain encryption warnings', () => {
      expect(schemaContent).toContain('ENCRYPTED');
      expect(schemaContent).toContain('encrypted at rest');
    });

    it('should document that secrets are stored here', () => {
      expect(schemaContent).toContain('ALL user secrets');
      expect(schemaContent).toContain('REAL SECRETS');
    });

    it('should document isolation per user', () => {
      expect(schemaContent).toContain('isolated per user');
    });
  });

  describe('Required Tables', () => {
    it('should define Connection model', () => {
      expect(schemaContent).toContain('model Connection');
    });

    it('should define Skill model', () => {
      expect(schemaContent).toContain('model Skill');
    });

    it('should define Execution model', () => {
      expect(schemaContent).toContain('model Execution');
    });

    it('should define Config model', () => {
      expect(schemaContent).toContain('model Config');
    });
  });

  describe('Connection Model', () => {
    it('should have config field marked as containing secrets', () => {
      // Check that Connection model exists and has config field
      expect(schemaContent).toMatch(/model Connection/);
      expect(schemaContent).toMatch(/config\s+Json/);
    });

    it('should document encryption in config field', () => {
      expect(schemaContent).toMatch(/config.*ENCRYPTED|ENCRYPTED.*config/s);
    });

    it('should have tools array field', () => {
      expect(schemaContent).toContain('tools');
      expect(schemaContent).toContain('String[]');
    });
  });

  describe('Skill Model', () => {
    it('should have steps field as Json', () => {
      expect(schemaContent).toContain('steps');
      expect(schemaContent).toMatch(/steps\s+Json/);
    });

    it('should have connectionNames array', () => {
      expect(schemaContent).toContain('connectionNames');
      expect(schemaContent).toContain('String[]');
    });

    it('should support different trigger types', () => {
      expect(schemaContent).toContain('triggerType');
      expect(schemaContent).toContain('triggerConfig');
    });

    it('should have isSystem flag for protected skills', () => {
      expect(schemaContent).toContain('isSystem');
      expect(schemaContent).toContain('Boolean');
    });
  });

  describe('Execution Model', () => {
    it('should store full execution traces', () => {
      expect(schemaContent).toContain('trace');
      expect(schemaContent).toContain('input');
      expect(schemaContent).toContain('output');
    });

    it('should track reporting to Alfred Core', () => {
      expect(schemaContent).toContain('reportedToCore');
    });

    it('should have status field', () => {
      expect(schemaContent).toContain('status');
    });

    it('should track execution metrics', () => {
      expect(schemaContent).toContain('durationMs');
      expect(schemaContent).toContain('tokenCount');
      expect(schemaContent).toContain('costUsd');
    });
  });

  describe('Config Model', () => {
    it('should use key as primary key', () => {
      const configModelMatch = schemaContent.match(/model Config\s*{[^}]+}/s);
      expect(configModelMatch).toBeTruthy();
      const configModel = configModelMatch![0];
      expect(configModel).toContain('@id');
      expect(configModel).toContain('key');
    });

    it('should document encryption of values', () => {
      expect(schemaContent).toMatch(/Config.*encrypted|encrypted.*Config/s);
    });
  });

  describe('Indexes', () => {
    it('should have index on Connection.name for fast lookups', () => {
      expect(schemaContent).toContain('@unique');
      expect(schemaContent).toMatch(/name.*@unique/);
    });

    it('should have indexes on Execution for querying', () => {
      expect(schemaContent).toMatch(/@@index.*skill|skill.*@@index/s);
    });

    it('should have index on reportedToCore for billing sync', () => {
      expect(schemaContent).toContain('@@index([reportedToCore])');
    });
  });

  describe('Relations', () => {
    it('should have Skill to Execution relation with cascade delete', () => {
      expect(schemaContent).toContain('Execution[]');
      expect(schemaContent).toContain('onDelete: Cascade');
    });

    it('should have many-to-many relation between Skills and Connections', () => {
      expect(schemaContent).toContain('@relation("SkillConnections")');
    });
  });
});
