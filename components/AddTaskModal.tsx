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
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Priority } from '../types';

interface NewTask {
  text: string;
  priority: Priority;
  dueDate: string;
  dueTime: string;
  category: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onAdd: (task: NewTask) => void;
}

const PRIORITIES: { label: string; value: Priority; color: string }[] = [
  { label: 'High', value: 'high', color: '#FF453A' },
  { label: 'Medium', value: 'medium', color: '#FF9F0A' },
  { label: 'Low', value: 'low', color: '#30D158' },
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

export default function AddTaskModal({ visible, onClose, onAdd }: Props) {
  const [text, setText] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [category, setCategory] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');

  const reset = () => {
    setText('');
    setPriority('medium');
    setCategory('');
    setDueDate('');
    setDueTime('');
    setShowDatePicker(false);
    setShowTimePicker(false);
  };

  const handleAdd = () => {
    if (!text.trim()) return;
    onAdd({ text: text.trim(), priority, dueDate: dueDate || toLocalDateString(new Date()), dueTime, category });
    reset();
    onClose();
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose}>
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>New Task</Text>
          <TouchableOpacity onPress={handleAdd}>
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

          {/* Priority */}
          <Text style={styles.sectionLabel}>Priority</Text>
          <View style={styles.row}>
            {PRIORITIES.map(p => (
              <TouchableOpacity
                key={p.value}
                style={[styles.chip, priority === p.value && { backgroundColor: p.color, borderColor: p.color }]}
                onPress={() => setPriority(p.value)}
              >
                <Text style={[styles.chipText, priority === p.value && styles.chipTextActive]}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Due date */}
          <Text style={styles.sectionLabel}>Due Date</Text>
          <TouchableOpacity style={styles.fieldRow} onPress={() => setShowDatePicker(!showDatePicker)}>
            <Text style={styles.fieldIcon}>📅</Text>
            <Text style={[styles.fieldValue, !dueDate && styles.fieldPlaceholder]}>
              {dueDate || 'Select date'}
            </Text>
            {dueDate && (
              <TouchableOpacity onPress={() => setDueDate('')}>
                <Text style={styles.clearBtn}>✕</Text>
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
          <TouchableOpacity style={styles.fieldRow} onPress={() => setShowTimePicker(!showTimePicker)}>
            <Text style={styles.fieldIcon}>🕒</Text>
            <Text style={[styles.fieldValue, !dueTime && styles.fieldPlaceholder]}>
              {dueTime || 'Select time'}
            </Text>
            {dueTime && (
              <TouchableOpacity onPress={() => setDueTime('')}>
                <Text style={styles.clearBtn}>✕</Text>
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

          {/* Category */}
          <Text style={styles.sectionLabel}>Category</Text>
          <View style={styles.row}>
            {CATEGORIES.map(c => (
              <TouchableOpacity
                key={c}
                style={[styles.chip, category === c && styles.chipActive]}
                onPress={() => setCategory(category === c ? '' : c)}
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
  container: { flex: 1, backgroundColor: '#1C1C1E' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  title: { fontSize: 17, fontWeight: '600', color: '#FFFFFF' },
  cancel: { fontSize: 17, color: '#636366' },
  add: { fontSize: 17, fontWeight: '600', color: '#1877F2' },
  addDisabled: { color: '#48484A' },
  body: { flex: 1, padding: 20 },
  textInput: {
    fontSize: 18,
    color: '#FFFFFF',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 16,
    minHeight: 80,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 24,
  },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: '#636366', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  chipActive: { backgroundColor: '#1877F2', borderColor: '#1877F2' },
  chipText: { fontSize: 14, color: '#EBEBF5' },
  chipTextActive: { color: '#FFFFFF', fontWeight: '600' },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 24,
    gap: 10,
  },
  fieldIcon: { fontSize: 18 },
  fieldValue: { flex: 1, fontSize: 16, color: '#FFFFFF' },
  fieldPlaceholder: { color: '#636366' },
  clearBtn: { color: '#636366', fontSize: 16, paddingHorizontal: 4 },
});
