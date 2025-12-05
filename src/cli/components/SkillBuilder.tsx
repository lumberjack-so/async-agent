/**
 * SkillBuilder TUI Component
 * Interactive multi-step wizard for creating skills
 */

import React, { useState } from 'react';
import { Box, Text, Newline } from 'ink';
import TextInput from 'ink-text-input';
import SelectInput from 'ink-select-input';
import { SkillBuilderProps, SkillCreateInput, StepInput } from '../types.js';

type WizardStep = 'basic' | 'steps' | 'review';
type StepField = 'prompt' | 'guidance' | 'tools' | 'connections' | 'action';

export const SkillBuilder: React.FC<SkillBuilderProps> = ({ onSave, onCancel }) => {
  // Wizard state
  const [currentStep, setCurrentStep] = useState<WizardStep>('basic');

  // Basic info state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerType, setTriggerType] = useState<'classifier' | 'orchestrator' | 'default'>('orchestrator');
  const [connectionNames, setConnectionNames] = useState('');
  const [basicField, setBasicField] = useState<'name' | 'description' | 'trigger' | 'connections' | 'action'>('name');

  // Steps state
  const [steps, setSteps] = useState<StepInput[]>([]);
  const [stepPrompt, setStepPrompt] = useState('');
  const [stepGuidance, setStepGuidance] = useState('');
  const [stepTools, setStepTools] = useState('');
  const [stepConns, setStepConns] = useState('');
  const [stepField, setStepField] = useState<StepField>('prompt');

  // Error state
  const [error, setError] = useState('');

  // Navigation handlers
  const handleBasicNext = () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    setError('');
    setCurrentStep('steps');
  };

  const handleAddStep = () => {
    if (!stepPrompt.trim()) {
      setError('Step prompt is required');
      return;
    }

    const newStep: StepInput = {
      id: steps.length + 1,
      prompt: stepPrompt.trim(),
      guidance: stepGuidance.trim() || undefined,
      allowedTools: stepTools ? stepTools.split(',').map(t => t.trim()).filter(t => t) : undefined,
      connectionNames: stepConns ? stepConns.split(',').map(c => c.trim()).filter(c => c) : undefined,
    };

    setSteps([...steps, newStep]);
    setStepPrompt('');
    setStepGuidance('');
    setStepTools('');
    setStepConns('');
    setStepField('prompt');
    setError('');
  };

  const handleStepsNext = () => {
    if (steps.length === 0) {
      setError('At least one step is required');
      return;
    }
    setError('');
    setCurrentStep('review');
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (steps.length === 0) {
      setError('At least one step is required');
      return;
    }

    const skillData: SkillCreateInput = {
      name: name.trim(),
      description: description.trim(),
      triggerType,
      steps,
      connectionNames: connectionNames ? connectionNames.split(',').map(c => c.trim()).filter(c => c) : undefined,
      isActive: true
    };

    setError('');
    await onSave(skillData);
  };

  // Render Basic Info Step
  if (currentStep === 'basic') {
    return (
      <Box flexDirection="column" padding={1}>
        <Box borderStyle="round" borderColor="cyan" flexDirection="column" padding={1}>
          <Text bold color="cyan">Step 1: Basic Information</Text>
          <Newline />

          <Text>Name: </Text>
          {basicField === 'name' ? (
            <TextInput
              value={name}
              onChange={setName}
              onSubmit={() => setBasicField('description')}
            />
          ) : (
            <Text color="gray">{name || '(empty)'}</Text>
          )}
          <Newline />

          <Text>Description: </Text>
          {basicField === 'description' ? (
            <TextInput
              value={description}
              onChange={setDescription}
              onSubmit={() => setBasicField('trigger')}
            />
          ) : (
            <Text color="gray">{description || '(empty)'}</Text>
          )}
          <Newline />

          <Text>Trigger Type: </Text>
          {basicField === 'trigger' ? (
            <SelectInput
              items={[
                { label: 'orchestrator', value: 'orchestrator' },
                { label: 'classifier', value: 'classifier' },
                { label: 'default', value: 'default' }
              ]}
              onSelect={(item) => {
                setTriggerType(item.value as 'classifier' | 'orchestrator' | 'default');
                setBasicField('connections');
              }}
            />
          ) : (
            <Text color="gray">{triggerType}</Text>
          )}
          <Newline />

          <Text>Connection Names (comma-separated, optional): </Text>
          {basicField === 'connections' ? (
            <TextInput
              value={connectionNames}
              onChange={setConnectionNames}
              onSubmit={() => setBasicField('action')}
            />
          ) : (
            <Text color="gray">{connectionNames || '(empty)'}</Text>
          )}
          <Newline />

          {error && (
            <>
              <Text color="red">✗ {error}</Text>
              <Newline />
            </>
          )}

          {basicField === 'action' && (
            <>
              <Text color="yellow">Actions:</Text>
              <SelectInput
                items={[
                  { label: 'Next', value: 'next' },
                  { label: 'Cancel', value: 'cancel' }
                ]}
                onSelect={(item) => {
                  if (item.value === 'next') {
                    handleBasicNext();
                  } else {
                    onCancel();
                  }
                }}
              />
            </>
          )}

          {basicField !== 'action' && (
            <>
              <Newline />
              <Text color="gray" dimColor>Press Enter to move to next field</Text>
              <Text color="gray" dimColor>Press Tab to jump to actions</Text>
            </>
          )}
        </Box>
      </Box>
    );
  }

  // Render Steps Step
  if (currentStep === 'steps') {
    return (
      <Box flexDirection="column" padding={1}>
        <Box borderStyle="round" borderColor="cyan" flexDirection="column" padding={1}>
          <Text bold color="cyan">Step 2: Add Steps ({steps.length} added)</Text>
          <Newline />

          {steps.length > 0 && (
            <>
              <Text color="green">Added Steps:</Text>
              {steps.map((step, idx) => (
                <Text key={step.id} color="gray">
                  {idx + 1}. {step.prompt.substring(0, 50)}{step.prompt.length > 50 ? '...' : ''}
                </Text>
              ))}
              <Newline />
            </>
          )}

          <Text>Prompt: </Text>
          {stepField === 'prompt' ? (
            <TextInput
              value={stepPrompt}
              onChange={setStepPrompt}
              onSubmit={() => setStepField('guidance')}
            />
          ) : (
            <Text color="gray">{stepPrompt || '(empty)'}</Text>
          )}
          <Newline />

          <Text>Guidance (optional): </Text>
          {stepField === 'guidance' ? (
            <TextInput
              value={stepGuidance}
              onChange={setStepGuidance}
              onSubmit={() => setStepField('tools')}
            />
          ) : (
            <Text color="gray">{stepGuidance || '(empty)'}</Text>
          )}
          <Newline />

          <Text>Allowed Tools (comma-separated, optional): </Text>
          {stepField === 'tools' ? (
            <TextInput
              value={stepTools}
              onChange={setStepTools}
              onSubmit={() => setStepField('connections')}
            />
          ) : (
            <Text color="gray">{stepTools || '(empty)'}</Text>
          )}
          <Newline />

          <Text>Connection Names (comma-separated, optional): </Text>
          {stepField === 'connections' ? (
            <TextInput
              value={stepConns}
              onChange={setStepConns}
              onSubmit={() => setStepField('action')}
            />
          ) : (
            <Text color="gray">{stepConns || '(empty)'}</Text>
          )}
          <Newline />

          {error && (
            <>
              <Text color="red">✗ {error}</Text>
              <Newline />
            </>
          )}

          {stepField === 'action' && (
            <>
              <Text color="yellow">Actions:</Text>
              <SelectInput
                items={[
                  { label: 'Add Another Step', value: 'add' },
                  { label: 'Next', value: 'next' },
                  { label: 'Back', value: 'back' },
                  { label: 'Cancel', value: 'cancel' }
                ]}
                onSelect={(item) => {
                  if (item.value === 'add') {
                    handleAddStep();
                  } else if (item.value === 'next') {
                    handleStepsNext();
                  } else if (item.value === 'back') {
                    setCurrentStep('basic');
                    setBasicField('name');
                  } else {
                    onCancel();
                  }
                }}
              />
            </>
          )}

          {stepField !== 'action' && (
            <>
              <Newline />
              <Text color="gray" dimColor>Press Enter to move to next field</Text>
              <Text color="gray" dimColor>Press Tab to jump to actions</Text>
            </>
          )}
        </Box>
      </Box>
    );
  }

  // Render Review Step
  return (
    <Box flexDirection="column" padding={1}>
      <Box borderStyle="round" borderColor="cyan" flexDirection="column" padding={1}>
        <Text bold color="cyan">Step 3: Review</Text>
        <Newline />

        <Text bold>Name:</Text>
        <Text>{name}</Text>
        <Newline />

        <Text bold>Description:</Text>
        <Text>{description || '(none)'}</Text>
        <Newline />

        <Text bold>Trigger Type:</Text>
        <Text>{triggerType}</Text>
        <Newline />

        <Text bold>Connection Names:</Text>
        <Text>{connectionNames || '(none)'}</Text>
        <Newline />

        <Text bold>Steps ({steps.length}):</Text>
        {steps.map((step, idx) => (
          <Box key={step.id} flexDirection="column" marginLeft={2}>
            <Text color="cyan">Step {idx + 1}:</Text>
            <Text>  Prompt: {step.prompt}</Text>
            {step.guidance && <Text>  Guidance: {step.guidance}</Text>}
            {step.allowedTools && <Text>  Tools: {step.allowedTools.join(', ')}</Text>}
            {step.connectionNames && <Text>  Connections: {step.connectionNames.join(', ')}</Text>}
            <Newline />
          </Box>
        ))}

        {error && (
          <>
            <Text color="red">✗ {error}</Text>
            <Newline />
          </>
        )}

        <Text color="yellow">Actions:</Text>
        <SelectInput
          items={[
            { label: 'Save', value: 'save' },
            { label: 'Back', value: 'back' },
            { label: 'Cancel', value: 'cancel' }
          ]}
          onSelect={(item) => {
            if (item.value === 'save') {
              handleSave();
            } else if (item.value === 'back') {
              setCurrentStep('steps');
              setStepField('prompt');
            } else {
              onCancel();
            }
          }}
        />
      </Box>
    </Box>
  );
};
