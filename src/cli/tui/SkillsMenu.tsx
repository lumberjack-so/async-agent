/**
 * Skills Menu Component
 * Interactive menu for managing skills in TUI mode
 */

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import { db } from '../lib/db.js';
import { SkillBuilder } from '../components/SkillBuilder.js';
import { SkillEditor } from '../components/SkillEditor.js';
import type { Skill } from '@prisma/client';

interface SkillsMenuProps {
  onBack: () => void;
}

type MenuState = 'main' | 'list' | 'create' | 'edit' | 'delete';

export const SkillsMenu: React.FC<SkillsMenuProps> = ({ onBack }) => {
  const [state, setState] = useState<MenuState>('main');
  const [skills, setSkills] = useState<Skill[]>([]);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (state === 'list' || state === 'main') {
      loadSkills();
    }
  }, [state]);

  const loadSkills = async () => {
    setLoading(true);
    setError(null);
    try {
      const allSkills = await db.listSkills();
      setSkills(allSkills);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load skills');
    } finally {
      setLoading(false);
    }
  };

  // Main menu
  if (state === 'main') {
    return (
      <Box flexDirection="column" padding={1}>
        <Box
          borderStyle="round"
          borderColor="cyan"
          paddingX={2}
          paddingY={0}
          marginBottom={1}
        >
          <Text bold color="cyan">
            Skills Menu
          </Text>
        </Box>

        {loading ? (
          <Text>Loading skills...</Text>
        ) : error ? (
          <Box flexDirection="column">
            <Text color="red">✗ {error}</Text>
            <Box marginTop={1}>
              <SelectInput
                items={[{ label: 'Back to chat', value: 'back' }]}
                onSelect={() => onBack()}
              />
            </Box>
          </Box>
        ) : (
          <SelectInput
            items={[
              { label: `📋 List all skills (${skills.length})`, value: 'list' },
              { label: '➕ Create new skill', value: 'create' },
              { label: '✏️  Edit skill', value: 'edit' },
              { label: '🗑️  Delete skill', value: 'delete' },
              { label: '← Back to chat', value: 'back' },
            ]}
            onSelect={(item) => {
              if (item.value === 'back') {
                onBack();
              } else {
                setState(item.value as MenuState);
              }
            }}
          />
        )}
      </Box>
    );
  }

  // List skills
  if (state === 'list') {
    return (
      <Box flexDirection="column" padding={1}>
        <Box
          borderStyle="round"
          borderColor="cyan"
          paddingX={2}
          paddingY={0}
          marginBottom={1}
        >
          <Text bold color="cyan">
            All Skills ({skills.length})
          </Text>
        </Box>

        {skills.length === 0 ? (
          <Box flexDirection="column">
            <Text dimColor>No skills found</Text>
            <Box marginTop={1}>
              <SelectInput
                items={[{ label: 'Back to menu', value: 'back' }]}
                onSelect={() => setState('main')}
              />
            </Box>
          </Box>
        ) : (
          <Box flexDirection="column">
            {skills.map((skill) => (
              <Box key={skill.id} marginY={0}>
                <Text color={skill.isActive ? 'green' : 'gray'}>
                  {skill.isActive ? '✓' : '○'}
                </Text>
                <Box marginLeft={1}>
                  <Text bold>{skill.name}</Text>
                </Box>
                <Box marginLeft={1}>
                  <Text dimColor>({skill.triggerType})</Text>
                </Box>
              </Box>
            ))}

            <Box marginTop={1}>
              <SelectInput
                items={[{ label: '← Back to menu', value: 'back' }]}
                onSelect={() => setState('main')}
              />
            </Box>
          </Box>
        )}
      </Box>
    );
  }

  // Create skill
  if (state === 'create') {
    return (
      <SkillBuilder
        onSave={async (skillData) => {
          try {
            await db.createSkill(skillData);
            setState('main');
            await loadSkills();
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create skill');
            setState('main');
          }
        }}
        onCancel={() => setState('main')}
      />
    );
  }

  // Edit skill - first select which one
  if (state === 'edit') {
    if (!selectedSkillId) {
      return (
        <Box flexDirection="column" padding={1}>
          <Box
            borderStyle="round"
            borderColor="cyan"
            paddingX={2}
            paddingY={0}
            marginBottom={1}
          >
            <Text bold color="cyan">
              Select Skill to Edit
            </Text>
          </Box>

          {skills.length === 0 ? (
            <Box flexDirection="column">
              <Text dimColor>No skills available</Text>
              <Box marginTop={1}>
                <SelectInput
                  items={[{ label: 'Back to menu', value: 'back' }]}
                  onSelect={() => setState('main')}
                />
              </Box>
            </Box>
          ) : (
            <SelectInput
              items={[
                ...skills.map((skill) => ({
                  label: skill.name,
                  value: skill.id,
                })),
                { label: '← Back', value: 'back' },
              ]}
              onSelect={(item) => {
                if (item.value === 'back') {
                  setState('main');
                } else {
                  setSelectedSkillId(item.value);
                }
              }}
            />
          )}
        </Box>
      );
    }

    return (
      <SkillEditor
        skillId={selectedSkillId}
        onSave={async (skillData) => {
          try {
            await db.updateSkill(selectedSkillId, skillData);
            setSelectedSkillId(null);
            setState('main');
            await loadSkills();
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update skill');
            setSelectedSkillId(null);
            setState('main');
          }
        }}
        onCancel={() => {
          setSelectedSkillId(null);
          setState('main');
        }}
      />
    );
  }

  // Delete skill
  if (state === 'delete') {
    return (
      <Box flexDirection="column" padding={1}>
        <Box
          borderStyle="round"
          borderColor="red"
          paddingX={2}
          paddingY={0}
          marginBottom={1}
        >
          <Text bold color="red">
            Delete Skill
          </Text>
        </Box>

        {skills.length === 0 ? (
          <Box flexDirection="column">
            <Text dimColor>No skills available</Text>
            <Box marginTop={1}>
              <SelectInput
                items={[{ label: 'Back to menu', value: 'back' }]}
                onSelect={() => setState('main')}
              />
            </Box>
          </Box>
        ) : (
          <Box flexDirection="column">
            <Box marginBottom={1}>
              <Text color="yellow">⚠ Warning: This action cannot be undone</Text>
            </Box>

            <SelectInput
              items={[
                ...skills.map((skill) => ({
                  label: `Delete: ${skill.name}`,
                  value: skill.id,
                })),
                { label: '← Cancel', value: 'back' },
              ]}
              onSelect={async (item) => {
                if (item.value === 'back') {
                  setState('main');
                } else {
                  try {
                    await db.deleteSkill(item.value);
                    await loadSkills();
                    setState('main');
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Failed to delete skill');
                    setState('main');
                  }
                }
              }}
            />
          </Box>
        )}
      </Box>
    );
  }

  return null;
};
