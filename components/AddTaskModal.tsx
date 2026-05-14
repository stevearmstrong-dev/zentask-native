import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Priority } from '../types';
import AIAssistButton from './AIAssistButton';
import VoiceInputButton from './VoiceInputButton';
import { AIAssistAuthRequiredError, parseNaturalLanguageTask } from '../services/claude';
import { Colors, Spacing, Typography, BorderRadius, ComponentTokens, getPriorityColor } from '../constants/theme';

interface NewTask {
  text: string;
  priority: Priority;
  dueDate: string;
  dueTime: string;
  category: string;
  reminderMinutes: number | null;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onAdd: (task: NewTask) => void;
}

const PRIORITIES: { label: string; value: Priority; icon: keyof typeof Ionicons.glyphMap }[] = [
  { label: 'High', value: 'high', icon: 'alert-circle' },
  { label: 'Medium', value: 'medium', icon: 'remove-circle' },
  { label: 'Low', value: 'low', icon: 'checkmark-circle' },
];

const CATEGORIES = ['Work', 'Personal', 'Health', 'Finance', 'Learning', 'Other'];

function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toTimeString(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

const REMINDER_OPTIONS: { label: string; value: number | null }[] = [
  { label: 'None', value: null },
  { label: '5m', value: 5 },
  { label: '15m', value: 15 },
  { label: '30m', value: 30 },
  { label: '1h', value: 60 },
  { label: '1 day', value: 1440 },
];

export default function AddTaskModal({ visible, onClose, onAdd }: Props) {
  const [text, setText] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [category, setCategory] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [reminderMinutes, setReminderMinutes] = useState<number | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const reset = () => {
    setText('');
    setPriority('medium');
    setCategory('');
    setDueDate('');
    setDueTime('');
    setReminderMinutes(null);
    setShowDatePicker(false);
    setShowTimePicker(false);
  };

  const handleAdd = () => {
    if (!text.trim()) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onAdd({ text: text.trim(), priority, dueDate: dueDate || toLocalDateString(new Date()), dueTime, category, reminderMinutes });
    reset();
    onClose();
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleAIAssist = async (inputText?: string) => {
    const taskText = inputText || text;

    if (!taskText.trim()) {
      Alert.alert('Enter Task First', 'Please type a task description before using AI Assist.');
      return;
    }

    setAiLoading(true);
    try {
      const parsed = await parseNaturalLanguageTask(taskText);

      // Update form fields with parsed data
      setText(parsed.text);
      if (parsed.priority) setPriority(parsed.priority);
      if (parsed.dueDate) setDueDate(parsed.dueDate);
      if (parsed.dueTime) setDueTime(parsed.dueTime);
      if (parsed.category) setCategory(parsed.category);
      if (parsed.reminderMinutes) setReminderMinutes(parsed.reminderMinutes);

      Alert.alert(
        'AI Assist Complete',
        'I\'ve parsed your task and filled in the details. Review and adjust as needed!',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.warn('AI assist failed:', error);
      const message = error instanceof AIAssistAuthRequiredError
        ? 'Please sign in before using AI Assist.'
        : 'Sorry, I couldn\'t parse your task. Please try again or fill in the details manually.';

      Alert.alert(
        'AI Assist Failed',
        message,
        [{ text: 'OK' }]
      );
    } finally {
      setAiLoading(false);
    }
  };

  const handleVoiceTranscript = async (transcript: string) => {
    // Set the text field with the transcript
    setText(transcript);

    // Automatically parse with AI
    await handleAIAssist(transcript);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>New Task</Text>
          <TouchableOpacity
            onPress={handleAdd}
            disabled={!text.trim()}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.add, !text.trim() && styles.addDisabled]}>Add</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
          {/* Task text */}
          <TextInput
            style={styles.textInput}
            placeholder="What needs to be done?"
            placeholderTextColor="#636366"
            value={text}
            onChangeText={setText}
            multiline
            autoFocus
          />

          {/* AI Assist Buttons */}
          <View style={styles.aiAssistContainer}>
            <View style={styles.buttonRow}>
              <View style={styles.buttonHalf}>
                <VoiceInputButton
                  onTranscript={handleVoiceTranscript}
                  disabled={aiLoading}
                />
              </View>
              <View style={styles.buttonHalf}>
                <AIAssistButton
                  onPress={() => handleAIAssist()}
                  loading={aiLoading}
                  disabled={!text.trim()}
                  variant="secondary"
                  text="Parse Text"
                />
              </View>
            </View>
            <Text style={styles.aiHint}>
              Use voice or type: "Dentist tomorrow 2pm" or "Weekly team meeting every Monday at 9am"
            </Text>
          </View>

          {/* Priority */}
          <Text style={styles.sectionLabel}>Priority</Text>
          <View style={styles.row}>
            {PRIORITIES.map(p => {
              const isActive = priority === p.value;
              const priorityColor = getPriorityColor(p.value);
              return (
                <TouchableOpacity
                  key={p.value}
                  style={[
                    styles.chip,
                    isActive && { backgroundColor: priorityColor, borderColor: priorityColor }
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setPriority(p.value);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={p.icon}
                    size={16}
                    color={isActive ? Colors.text.primary : priorityColor}
                  />
                  <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                    {p.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Due date */}
          <Text style={styles.sectionLabel}>Due Date</Text>
          <TouchableOpacity
            style={styles.fieldRow}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowDatePicker(!showDatePicker);
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="calendar-outline" size={20} color={Colors.text.tertiary} />
            <Text style={[styles.fieldValue, !dueDate && styles.fieldPlaceholder]}>
              {dueDate || 'Select date'}
            </Text>
            {dueDate && (
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setDueDate('');
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={18} color={Colors.text.tertiary} />
              </TouchableOpacity>
            )}
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={dueDate ? new Date(dueDate + 'T00:00:00') : new Date()}
              mode="date"
              display="inline"
              minimumDate={new Date()}
              themeVariant="dark"
              onChange={(_, date) => {
                if (date) setDueDate(toLocalDateString(date));
                setShowDatePicker(false);
              }}
            />
          )}

          {/* Due time */}
          <Text style={styles.sectionLabel}>Due Time</Text>
          <TouchableOpacity
            style={styles.fieldRow}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowTimePicker(!showTimePicker);
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="time-outline" size={20} color={Colors.text.tertiary} />
            <Text style={[styles.fieldValue, !dueTime && styles.fieldPlaceholder]}>
              {dueTime || 'Select time'}
            </Text>
            {dueTime && (
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setDueTime('');
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={18} color={Colors.text.tertiary} />
              </TouchableOpacity>
            )}
          </TouchableOpacity>
          {showTimePicker && (
            <DateTimePicker
              value={dueTime ? (() => { const d = new Date(); const [h,m] = dueTime.split(':'); d.setHours(+h,+m); return d; })() : new Date()}
              mode="time"
              display="spinner"
              themeVariant="dark"
              onChange={(_, date) => {
                if (date) setDueTime(toTimeString(date));
                setShowTimePicker(false);
              }}
            />
          )}

          {/* Reminder */}
          <Text style={styles.sectionLabel}>Reminder</Text>
          <View style={styles.row}>
            {REMINDER_OPTIONS.map(opt => (
              <TouchableOpacity
                key={String(opt.value)}
                style={[styles.chip, reminderMinutes === opt.value && styles.chipActive]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setReminderMinutes(opt.value);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, reminderMinutes === opt.value && styles.chipTextActive]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Category */}
          <Text style={styles.sectionLabel}>Category</Text>
          <View style={styles.row}>
            {CATEGORIES.map(c => (
              <TouchableOpacity
                key={c}
                style={[styles.chip, category === c && styles.chipActive]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setCategory(category === c ? '' : c);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.default,
  },
  title: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text.primary
  },
  cancel: {
    fontSize: Typography.fontSize.xl,
    color: Colors.text.tertiary
  },
  add: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.interactive.primary
  },
  addDisabled: { color: Colors.text.disabled },
  body: {
    flex: 1,
    padding: Spacing.xl
  },
  textInput: {
    fontSize: Typography.fontSize.xxl,
    color: Colors.text.primary,
    backgroundColor: Colors.surface.input,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    minHeight: 80,
    borderWidth: 1,
    borderColor: Colors.border.default,
    marginBottom: Spacing.xxl,
  },
  sectionLabel: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: Typography.letterSpacing.wide,
    marginBottom: Spacing.md
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.xxl
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: ComponentTokens.chip.borderRadius,
    borderWidth: 1,
    borderColor: Colors.border.default,
    backgroundColor: Colors.surface.base,
  },
  chipActive: {
    backgroundColor: Colors.interactive.primary,
    borderColor: Colors.interactive.primary
  },
  chipText: {
    fontSize: Typography.fontSize.base,
    color: Colors.text.secondary
  },
  chipTextActive: {
    color: Colors.text.primary,
    fontWeight: Typography.fontWeight.semibold
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface.base,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border.default,
    marginBottom: Spacing.xxl,
    gap: Spacing.md,
  },
  fieldValue: {
    flex: 1,
    fontSize: Typography.fontSize.lg,
    color: Colors.text.primary
  },
  fieldPlaceholder: { color: Colors.text.tertiary },
  aiAssistContainer: {
    marginBottom: Spacing.xxl,
    gap: Spacing.sm,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  buttonHalf: {
    flex: 1,
  },
  aiHint: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.tertiary,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingHorizontal: Spacing.lg,
  },
});
