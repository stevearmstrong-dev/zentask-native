import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Task } from '../types';
import { useTasks } from '../context/TasksContext';

const PRIORITY_COLOR: Record<string, string> = {
  high: '#FF453A', medium: '#FF9F0A', low: '#30D158',
};

// Timeline constants
const SLOT_HEIGHT = 52;     // px per 30-minute slot
const TIME_LABEL_W = 64;    // width of time label column
const START_HOUR = 8;       // 8 AM
const END_HOUR = 20;        // 8 PM
const TOTAL_SLOTS = (END_HOUR - START_HOUR) * 2; // 24 slots of 30 min each
const TIMELINE_HEIGHT = TOTAL_SLOTS * SLOT_HEIGHT;

// Generate slot labels (every 30 min, 8 AM – 8 PM)
const TIME_SLOTS = (() => {
  const slots: { hour: number; minute: number; label: string; value: string }[] = [];
  for (let h = START_HOUR; h <= END_HOUR; h++) {
    for (const m of [0, 30]) {
      if (h === END_HOUR && m > 0) break;
      const h12 = h % 12 || 12;
      const period = h >= 12 ? 'PM' : 'AM';
      slots.push({
        hour: h, minute: m,
        label: `${h12}:${String(m).padStart(2, '0')} ${period}`,
        value: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
      });
    }
  }
  return slots;
})();

const LINE_OFFSET = 6; // matches slotLine marginTop — aligns block top with grid line

// Convert HH:MM to px offset from top of timeline
function timeToOffset(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return ((h - START_HOUR) * 60 + m) / 30 * SLOT_HEIGHT + LINE_OFFSET;
}

function formatTimeRange(dueTime: string, durationMins: number): string {
  const [h, m] = dueTime.split(':').map(Number);
  const endTotal = h * 60 + m + durationMins;
  const eh = Math.floor(endTotal / 60) % 24;
  const em = endTotal % 60;
  const fmt = (hh: number, mm: number) => {
    const h12 = hh % 12 || 12;
    const p = hh >= 12 ? 'PM' : 'AM';
    return `${h12}:${String(mm).padStart(2, '0')} ${p}`;
  };
  return `${fmt(h, m)} → ${fmt(eh, em)}`;
}

// Snap a tap Y position to nearest 30-min slot
function yToSlot(y: number): typeof TIME_SLOTS[0] | null {
  const idx = Math.max(0, Math.min(TOTAL_SLOTS - 1, Math.floor(y / SLOT_HEIGHT)));
  return TIME_SLOTS[idx] ?? null;
}

const DURATIONS = [15, 30, 45, 60, 90, 120];

export default function TimeBlocksScreen() {
  const { tasks, editTask } = useTasks();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [editingBlock, setEditingBlock] = useState<Task | null>(null);
  const [showDurationPicker, setShowDurationPicker] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];

  // Tasks with a dueTime set for today → scheduled (show on timeline)
  // All others (no dueDate, different date, or no dueTime) → unscheduled panel
  const scheduled = tasks.filter(t =>
    !t.completed && !!t.dueTime && t.dueDate === todayStr
  );
  const unscheduled = tasks.filter(t =>
    !t.completed && !(!!t.dueTime && t.dueDate === todayStr)
  );

  const handleTimelinePress = useCallback((y: number) => {
    if (!selectedTask) return;
    const slot = yToSlot(y);
    if (!slot) return;
    editTask(selectedTask.id as number, {
      dueDate: todayStr,
      dueTime: slot.value,
      scheduledDuration: selectedTask.scheduledDuration || 60,
    });
    setSelectedTask(null);
  }, [selectedTask, todayStr, editTask]);

  const handleUnschedule = useCallback((task: Task) => {
    Alert.alert('Unschedule', `Remove "${task.text}" from today's schedule?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unschedule', onPress: () => {
          editTask(task.id as number, { dueTime: undefined, scheduledDuration: undefined });
        },
      },
    ]);
  }, [editTask]);

  const handleSaveDuration = useCallback((duration: number) => {
    if (!editingBlock) return;
    editTask(editingBlock.id as number, { scheduledDuration: duration });
    setEditingBlock(null);
    setShowDurationPicker(false);
  }, [editingBlock, editTask]);

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>🕒 Time Blocks</Text>
        <Text style={s.subtitle}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </Text>
      </View>

      {/* Selection banner */}
      {selectedTask && (
        <View style={s.selectionBanner}>
          <View style={[s.selectionDot, { backgroundColor: PRIORITY_COLOR[selectedTask.priority] }]} />
          <Text style={s.selectionText} numberOfLines={1}>{selectedTask.text}</Text>
          <TouchableOpacity onPress={() => setSelectedTask(null)} style={s.selectionCancel}>
            <Text style={s.selectionCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={s.body}>
        {/* Left: Unscheduled tasks */}
        <View style={s.leftPanel}>
          <Text style={s.panelTitle}>Unscheduled{'\n'}({unscheduled.length})</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {unscheduled.length === 0 ? (
              <Text style={s.emptyText}>All{'\n'}scheduled!{'\n'}🎉</Text>
            ) : (
              unscheduled.map(task => (
                <TouchableOpacity
                  key={String(task.id)}
                  style={[
                    s.unscheduledTask,
                    selectedTask?.id === task.id && s.unscheduledTaskSelected,
                  ]}
                  onPress={() => setSelectedTask(prev => prev?.id === task.id ? null : task)}
                  activeOpacity={0.75}
                >
                  <View style={[s.priorityBar, { backgroundColor: PRIORITY_COLOR[task.priority] }]} />
                  <View style={s.taskContent}>
                    <Text style={s.taskText} numberOfLines={3}>{task.text}</Text>
                    {task.category ? <Text style={s.taskCategory}>{task.category}</Text> : null}
                  </View>
                </TouchableOpacity>
              ))
            )}
            {unscheduled.length > 0 && (
              <Text style={s.hint}>
                {selectedTask ? '👉 Tap a slot →' : '👆 Tap to select'}
              </Text>
            )}
          </ScrollView>
        </View>

        {/* Right: Absolute-positioned timeline */}
        <View style={s.rightPanel}>
          <Text style={s.panelTitle}>Schedule</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Tappable timeline area */}
            <TouchableOpacity
              activeOpacity={1}
              onPress={e => handleTimelinePress(e.nativeEvent.locationY)}
              disabled={!selectedTask}
            >
              <View style={{ height: TIMELINE_HEIGHT, position: 'relative' }}>

                {/* Slot grid lines + labels */}
                {TIME_SLOTS.map((slot, i) => (
                  <View
                    key={slot.value}
                    style={[
                      s.slotRow,
                      { top: i * SLOT_HEIGHT, height: SLOT_HEIGHT },
                      !!selectedTask && s.slotRowSelectable,
                    ]}
                    pointerEvents="none"
                  >
                    <Text style={s.timeLabel}>{slot.label}</Text>
                    <View style={s.slotLine} />
                  </View>
                ))}

                {/* Scheduled blocks — absolutely positioned */}
                {scheduled.map(task => {
                  if (!task.dueTime) return null;
                  const duration = task.scheduledDuration || 60;
                  const topOffset = timeToOffset(task.dueTime);
                  const blockHeight = (duration / 30) * SLOT_HEIGHT;
                  return (
                    <View
                      key={String(task.id)}
                      style={[
                        s.block,
                        {
                          top: topOffset,
                          height: blockHeight,
                          borderLeftColor: PRIORITY_COLOR[task.priority],
                        },
                      ]}
                      pointerEvents="box-none"
                    >
                      {blockHeight < 36 ? (
                        /* Pill layout for 15-min blocks */
                        <View style={s.pillInner}>
                          <View style={[s.pillDot, { backgroundColor: PRIORITY_COLOR[task.priority] }]} />
                          <Text style={s.pillText} numberOfLines={1}>{task.text}</Text>
                          <TouchableOpacity
                            onPress={() => handleUnschedule(task)}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          >
                            <Text style={s.pillAction}>✕</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        /* Full layout for 30-min+ blocks */
                        <View style={s.blockInner}>
                          <View style={s.blockTop}>
                            <Text style={s.blockText} numberOfLines={2}>{task.text}</Text>
                            <View style={s.blockActions}>
                              <TouchableOpacity
                                onPress={() => { setEditingBlock(task); setShowDurationPicker(true); }}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              >
                                <Text style={s.blockAction}>✏️</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={() => handleUnschedule(task)}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              >
                                <Text style={s.blockAction}>✕</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                          {blockHeight >= 40 && (
                            <Text style={s.blockTime}>{formatTimeRange(task.dueTime, duration)}</Text>
                          )}
                          {blockHeight >= 56 && task.category ? (
                            <Text style={s.blockCategory}>{task.category}</Text>
                          ) : null}
                        </View>
                      )}
                    </View>
                  );
                })}

              </View>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>

      {/* Duration picker modal */}
      <Modal visible={showDurationPicker} transparent animationType="slide" onRequestClose={() => setShowDurationPicker(false)}>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setShowDurationPicker(false)}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Change Duration</Text>
            {editingBlock && <Text style={s.modalSubtitle} numberOfLines={1}>{editingBlock.text}</Text>}
            <View style={s.durationGrid}>
              {DURATIONS.map(d => {
                const current = editingBlock?.scheduledDuration ?? 60;
                return (
                  <TouchableOpacity
                    key={d}
                    style={[s.durationChip, current === d && s.durationChipActive]}
                    onPress={() => handleSaveDuration(d)}
                  >
                    <Text style={[s.durationChipText, current === d && s.durationChipTextActive]}>
                      {d < 60 ? `${d}m` : d === 60 ? '1h' : `${d / 60}h`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 10 },
  title: { fontSize: 26, fontWeight: '700', color: '#FFFFFF' },
  subtitle: { fontSize: 13, color: '#636366', marginTop: 3 },

  selectionBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(24,119,242,0.15)', paddingHorizontal: 16, paddingVertical: 10,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(24,119,242,0.3)',
  },
  selectionDot: { width: 10, height: 10, borderRadius: 5 },
  selectionText: { flex: 1, fontSize: 13, color: '#EBEBF5', fontWeight: '500' },
  selectionCancel: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  selectionCancelText: { color: '#636366', fontSize: 12 },

  body: { flex: 1, flexDirection: 'row' },

  leftPanel: {
    width: 120, borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 8, paddingTop: 8,
  },
  rightPanel: { flex: 1, paddingTop: 8 },
  panelTitle: {
    fontSize: 11, fontWeight: '600', color: '#636366',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, paddingHorizontal: 4,
  },

  unscheduledTask: {
    flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10,
    marginBottom: 6, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  unscheduledTaskSelected: { borderColor: '#1877F2', backgroundColor: 'rgba(24,119,242,0.15)' },
  priorityBar: { width: 3 },
  taskContent: { flex: 1, padding: 7 },
  taskText: { fontSize: 11, color: '#EBEBF5', fontWeight: '500', lineHeight: 15 },
  taskCategory: { fontSize: 10, color: '#636366', marginTop: 3 },
  emptyText: { fontSize: 11, color: '#48484A', textAlign: 'center', paddingTop: 12, lineHeight: 17 },
  hint: { fontSize: 10, color: '#48484A', textAlign: 'center', marginTop: 10, lineHeight: 15 },

  // Slot grid
  slotRow: {
    position: 'absolute', left: 0, right: 0,
    flexDirection: 'row', alignItems: 'flex-start',
  },
  slotRowSelectable: { backgroundColor: 'rgba(24,119,242,0.03)' },
  timeLabel: {
    width: TIME_LABEL_W, fontSize: 10, color: '#48484A',
    paddingTop: 3, textAlign: 'right', paddingRight: 8,
  },
  slotLine: {
    flex: 1, height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginTop: 6,
  },

  // Blocks — absolute positioned
  block: {
    position: 'absolute',
    left: TIME_LABEL_W,
    right: 6,
    borderLeftWidth: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.09)',
    overflow: 'hidden',
  },
  // Pill layout (15-min blocks < 36px tall)
  pillInner: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 6, gap: 5,
  },
  pillDot: { width: 6, height: 6, borderRadius: 3, flexShrink: 0 },
  pillText: { flex: 1, fontSize: 10, color: '#EBEBF5', fontWeight: '600' },
  pillAction: { fontSize: 11, color: '#636366' },

  blockInner: { flex: 1, padding: 7, gap: 2 },
  blockTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
  blockText: { flex: 1, fontSize: 12, color: '#EBEBF5', fontWeight: '600', lineHeight: 16 },
  blockActions: { flexDirection: 'row', gap: 10 },
  blockAction: { fontSize: 14, color: '#636366' },
  blockTime: { fontSize: 10, color: '#636366' },
  blockCategory: { fontSize: 10, color: '#1877F2' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#1C1C1E', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', marginBottom: 4 },
  modalSubtitle: { fontSize: 13, color: '#636366', marginBottom: 18 },
  durationGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  durationChip: {
    paddingHorizontal: 22, paddingVertical: 13, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  durationChipActive: { backgroundColor: '#1877F2', borderColor: '#1877F2' },
  durationChipText: { fontSize: 15, fontWeight: '600', color: '#636366' },
  durationChipTextActive: { color: '#fff' },
});
