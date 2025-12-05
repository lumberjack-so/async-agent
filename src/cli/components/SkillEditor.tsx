/**
 * SkillEditor TUI Component
 * Interactive wizard for editing existing skills using Ink (React for terminal)
 */

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import { SkillEditorProps, SkillUpdateInput, StepInput } from '../types.js';
import { db } from '../lib/db.js';

type WizardStep =
  | 'loading'
  | 'name'
  | 'description'
  | 'triggerType'
  | 'connectionNames'
  | 'steps'
  | 'confirm';

export const SkillEditor: React.FC<SkillEditorProps> = ({ skillId, onSave, onCancel }) => {
  // Loading state
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerType, setTriggerType] = useState<'classifier' | 'orchestrator' | 'default'>('default');
  const [connectionNames, setConnectionNames] = useState('');
  const [steps, setSteps] = useState<StepInput[]>([]);

  // Wizard state
  const [currentStep, setCurrentStep] = useState<WizardStep>('loading');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Step editor state
  const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null);
  const [stepPrompt, setStepPrompt] = useState('');
  const [stepGuidance, setStepGuidance] = useState('');
  const [stepAllowedTools, setStepAllowedTools] = useState('');
  const [stepConnectionNames, setStepConnectionNames] = useState('');
  const [stepField, setStepField] = useState<'prompt' | 'guidance' | 'allowedTools' | 'connectionNames'>('prompt');

  // Load existing skill data on mount
  useEffect(() => {
    async function loadSkill() {
      try {
        setLoading(true);
        setLoadError(null);

        const skill = await db.getSkill(skillId);

        if (!skill) {
          throw new Error(`Skill with ID '${skillId}' not found`);
        }

        // Pre-populate form with existing values
        setName(skill.name);
        setDescription(skill.description || '');
        setTriggerType(skill.triggerType as 'classifier' | 'orchestrator' | 'default');
        setConnectionNames(skill.connectionNames?.join(', ') || '');
        setSteps((skill.steps as unknown as StepInput[]) || []);

        setLoading(false);
        setCurrentStep('name');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to load skill';
        setLoadError(errorMessage);
        setLoading(false);
      }
    }

    loadSkill();
  }, [skillId]);

  // Handle keyboard input
  useEffect(() => {
    const handleKeyPress = (str: string, key: any) => {
      // Allow Ctrl+C to cancel
      if (key.ctrl && key.name === 'c') {
        onCancel();
        return;
      }

      // Handle Escape to cancel
      if (key.name === 'escape') {
        onCancel();
        return;
      }

      // Handle step navigation
      if (currentStep === 'steps' && editingStepIndex === null) {
        if (key.name === 'return') {
          setCurrentStep('confirm');
        } else if (str === 'a' || str === 'A') {
          // Add new step
          const newStep: StepInput = {
            id: steps.length + 1,
            prompt: '',
            guidance: '',
            allowedTools: [],
            connectionNames: []
          };
          setSteps([...steps, newStep]);
          setEditingStepIndex(steps.length);
          setStepPrompt('');
          setStepGuidance('');
          setStepAllowedTools('');
          setStepConnectionNames('');
          setStepField('prompt');
        } else if (str === 'e' || str === 'E') {
          // Edit first step if exists
          if (steps.length > 0) {
            const step = steps[0];
            setEditingStepIndex(0);
            setStepPrompt(step.prompt);
            setStepGuidance(step.guidance || '');
            setStepAllowedTools(step.allowedTools?.join(', ') || '');
            setStepConnectionNames(step.connectionNames?.join(', ') || '');
            setStepField('prompt');
          }
        } else if (str === 'd' || str === 'D') {
          // Delete last step
          if (steps.length > 0) {
            setSteps(steps.slice(0, -1));
          }
        }
      }

      // Handle step field navigation
      if (editingStepIndex !== null && key.name === 'tab') {
        if (stepField === 'prompt') setStepField('guidance');
        else if (stepField === 'guidance') setStepField('allowedTools');
        else if (stepField === 'allowedTools') setStepField('connectionNames');
        else {
          // Save step and go back to steps list
          saveCurrentStep();
        }
      }

      // Handle confirm navigation
      if (currentStep === 'confirm') {
        if (str === 'y' || str === 'Y') {
          handleSave();
        } else if (str === 'n' || str === 'N') {
          setCurrentStep('name');
        }
      }
    };

    process.stdin.on('keypress', handleKeyPress);
    return () => {
      process.stdin.off('keypress', handleKeyPress);
    };
  }, [currentStep, steps, editingStepIndex, stepField, stepPrompt, stepGuidance, stepAllowedTools, stepConnectionNames, onCancel]);

  const saveCurrentStep = () => {
    if (editingStepIndex === null) return;

    const updatedStep: StepInput = {
      id: editingStepIndex + 1,
      prompt: stepPrompt.trim(),
      guidance: stepGuidance.trim() || undefined,
      allowedTools: stepAllowedTools ? stepAllowedTools.split(',').map(t => t.trim()).filter(Boolean) : undefined,
      connectionNames: stepConnectionNames ? stepConnectionNames.split(',').map(c => c.trim()).filter(Boolean) : undefined
    };

    const newSteps = [...steps];
    newSteps[editingStepIndex] = updatedStep;
    setSteps(newSteps);
    setEditingStepIndex(null);
  };

  const handleNext = (nextStep: WizardStep) => {
    setError(null);

    // Validate current step
    if (currentStep === 'name' && !name.trim()) {
      setError('Skill name is required');
      return;
    }
    if (currentStep === 'description' && !description.trim()) {
      setError('Description is required');
      return;
    }
    if (currentStep === 'steps' && steps.length === 0) {
      setError('At least one step is required');
      return;
    }

    setCurrentStep(nextStep);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      // Build partial update object (SkillUpdateInput)
      const updateData: SkillUpdateInput = {
        name: name.trim(),
        description: description.trim(),
        triggerType,
        steps,
        connectionNames: connectionNames ? connectionNames.split(',').map(c => c.trim()).filter(Boolean) : undefined,
      };

      await onSave(updateData);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to save skill');
      setSaving(false);
    }
  };

  // Render loading state
  if (loading) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="cyan">Loading skill...</Text>
      </Box>
    );
  }

  // Render load error state
  if (loadError) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="red">Error: {loadError}</Text>
        <Text dimColor>Press ESC or Ctrl+C to exit</Text>
      </Box>
    );
  }

  // Render saving state
  if (saving) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="cyan">Saving skill...</Text>
      </Box>
    );
  }

  // Render wizard steps
  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">Edit Skill</Text>
        <Text dimColor> (ESC to cancel)</Text>
      </Box>

      {error && (
        <Box marginBottom={1}>
          <Text color="red">Error: {error}</Text>
        </Box>
      )}

      {/* Step 1: Name */}
      {currentStep === 'name' && (
        <Box flexDirection="column">
          <Text>
            <Text color="yellow">1.</Text> Skill Name:
          </Text>
          <Box marginLeft={2}>
            <TextInput
              value={name}
              onChange={setName}
              onSubmit={() => handleNext('description')}
            />
          </Box>
          <Box marginTop={1}>
            <Text dimColor>Press Enter to continue</Text>
          </Box>
        </Box>
      )}

      {/* Step 2: Description */}
      {currentStep === 'description' && (
        <Box flexDirection="column">
          <Text>
            <Text color="yellow">2.</Text> Description:
          </Text>
          <Box marginLeft={2}>
            <TextInput
              value={description}
              onChange={setDescription}
              onSubmit={() => handleNext('triggerType')}
            />
          </Box>
          <Box marginTop={1}>
            <Text dimColor>Press Enter to continue</Text>
          </Box>
        </Box>
      )}

      {/* Step 3: Trigger Type */}
      {currentStep === 'triggerType' && (
        <Box flexDirection="column">
          <Text>
            <Text color="yellow">3.</Text> Trigger Type:
          </Text>
          <Box marginLeft={2} flexDirection="column">
            <Text>
              Current: <Text color="green">{triggerType}</Text>
            </Text>
            <Text dimColor>Options: classifier, orchestrator, default</Text>
            <TextInput
              value={triggerType}
              onChange={(value) => {
                if (value === 'classifier' || value === 'orchestrator' || value === 'default') {
                  setTriggerType(value);
                }
              }}
              onSubmit={() => handleNext('connectionNames')}
            />
          </Box>
          <Box marginTop={1}>
            <Text dimColor>Press Enter to continue</Text>
          </Box>
        </Box>
      )}

      {/* Step 4: Connection Names */}
      {currentStep === 'connectionNames' && (
        <Box flexDirection="column">
          <Text>
            <Text color="yellow">4.</Text> Connection Names (comma-separated, optional):
          </Text>
          <Box marginLeft={2}>
            <TextInput
              value={connectionNames}
              onChange={setConnectionNames}
              onSubmit={() => handleNext('steps')}
              placeholder="e.g., Notion, Slack, GitHub"
            />
          </Box>
          <Box marginTop={1}>
            <Text dimColor>Press Enter to continue</Text>
          </Box>
        </Box>
      )}

      {/* Step 5: Steps */}
      {currentStep === 'steps' && editingStepIndex === null && (
        <Box flexDirection="column">
          <Text>
            <Text color="yellow">5.</Text> Workflow Steps ({steps.length}):
          </Text>
          <Box marginLeft={2} flexDirection="column">
            {steps.map((step, index) => (
              <Box key={index} flexDirection="column" marginBottom={1}>
                <Text>
                  <Text color="cyan">Step {step.id}:</Text> {step.prompt.substring(0, 60)}
                  {step.prompt.length > 60 ? '...' : ''}
                </Text>
                {step.guidance && (
                  <Text dimColor>  Guidance: {step.guidance.substring(0, 50)}</Text>
                )}
              </Box>
            ))}
            <Box marginTop={1}>
              <Text dimColor>
                [A] Add step | [E] Edit first | [D] Delete last | [Enter] Continue
              </Text>
            </Box>
          </Box>
        </Box>
      )}

      {/* Step Editor */}
      {currentStep === 'steps' && editingStepIndex !== null && (
        <Box flexDirection="column">
          <Text>
            <Text color="yellow">Edit Step {editingStepIndex + 1}</Text>
          </Text>

          <Box marginLeft={2} flexDirection="column">
            <Text>
              Prompt {stepField === 'prompt' ? <Text color="green">(editing)</Text> : ''}:
            </Text>
            {stepField === 'prompt' ? (
              <TextInput
                value={stepPrompt}
                onChange={setStepPrompt}
                onSubmit={() => setStepField('guidance')}
              />
            ) : (
              <Text dimColor>{stepPrompt || '(empty)'}</Text>
            )}

            <Box marginTop={1}>
              <Text>
                Guidance {stepField === 'guidance' ? <Text color="green">(editing)</Text> : ''} (optional):
              </Text>
            </Box>
            {stepField === 'guidance' ? (
              <TextInput
                value={stepGuidance}
                onChange={setStepGuidance}
                onSubmit={() => setStepField('allowedTools')}
              />
            ) : (
              <Text dimColor>{stepGuidance || '(empty)'}</Text>
            )}

            <Box marginTop={1}>
              <Text>
                Allowed Tools {stepField === 'allowedTools' ? <Text color="green">(editing)</Text> : ''} (comma-separated, optional):
              </Text>
            </Box>
            {stepField === 'allowedTools' ? (
              <TextInput
                value={stepAllowedTools}
                onChange={setStepAllowedTools}
                onSubmit={() => setStepField('connectionNames')}
              />
            ) : (
              <Text dimColor>{stepAllowedTools || '(empty)'}</Text>
            )}

            <Box marginTop={1}>
              <Text>
                Connection Names {stepField === 'connectionNames' ? <Text color="green">(editing)</Text> : ''} (comma-separated, optional):
              </Text>
            </Box>
            {stepField === 'connectionNames' ? (
              <TextInput
                value={stepConnectionNames}
                onChange={setStepConnectionNames}
                onSubmit={() => {
                  saveCurrentStep();
                }}
              />
            ) : (
              <Text dimColor>{stepConnectionNames || '(empty)'}</Text>
            )}

            <Box marginTop={1}>
              <Text dimColor>Press Tab to move to next field, Enter to save</Text>
            </Box>
          </Box>
        </Box>
      )}

      {/* Step 6: Confirm */}
      {currentStep === 'confirm' && (
        <Box flexDirection="column">
          <Text bold color="green">Review Changes:</Text>
          <Box marginLeft={2} flexDirection="column" marginTop={1}>
            <Text>Name: <Text color="cyan">{name}</Text></Text>
            <Text>Description: <Text color="cyan">{description}</Text></Text>
            <Text>Trigger Type: <Text color="cyan">{triggerType}</Text></Text>
            <Text>Connections: <Text color="cyan">{connectionNames || '(none)'}</Text></Text>
            <Text>Steps: <Text color="cyan">{steps.length}</Text></Text>
          </Box>
          <Box marginTop={1}>
            <Text>
              Save these changes? <Text color="green">[Y]es</Text> / <Text color="red">[N]o</Text>
            </Text>
          </Box>
        </Box>
      )}
    </Box>
  );
};
