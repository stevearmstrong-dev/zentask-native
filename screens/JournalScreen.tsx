import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { User } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

function getKey(userEmail: string) {
  return `zentask:journal:${userEmail || 'guest'}`;
}

interface Note {
  id: string;
  title: string;
  body: string;
  color: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

const NOTE_COLORS = [
  '#0D1C22', // default teal-dark
  '#0A1A10', // deep green
  '#0A0E1A', // deep blue
  '#1A0A1A', // deep purple
  '#1A0F08', // deep amber
  '#1A0A0A', // deep red
];

const NOTE_ACCENT = [
  '#00E5CC',
  '#4ADE80',
  '#60A5FA',
  '#C084FC',
  '#F59E0B',
  '#F87171',
];

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7)  return d.toLocaleDateString('en-US', { weekday: 'short' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getTodayTitle(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

interface Props { user?: User | null; openDailyNote?: boolean; }

export default function JournalScreen({ user, openDailyNote }: Props) {
  const userEmail = user?.email || '';
  const STORAGE_KEY = useMemo(() => getKey(userEmail), [userEmail]);

  const [notes, setNotes] = useState<Note[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState('');
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  // Editor state
  const [editorTitle, setEditorTitle] = useState('');
  const [editorBody, setEditorBody] = useState('');
  const [editorColor, setEditorColor] = useState(NOTE_COLORS[0]);
  const [editorPinned, setEditorPinned] = useState(false);

  const fabAnim = useRef(new Animated.Value(1)).current;
  const dailyNoteOpened = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      if (raw) setNotes(JSON.parse(raw));
      setLoaded(true);
    }).catch(console.error);
  }, [STORAGE_KEY]);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(notes)).catch(console.error);
  }, [notes, loaded]);

  // Auto-open today's daily note when navigated from Today screen
  useEffect(() => {
    if (!loaded || !openDailyNote || dailyNoteOpened.current) return;
    dailyNoteOpened.current = true;
    const todayTitle = getTodayTitle();
    const existing = notes.find(n => n.title === todayTitle);
    if (existing) {
      openEdit(existing);
    } else {
      setEditingNote(null);
      setEditorTitle(todayTitle);
      setEditorBody('');
      setEditorColor(NOTE_COLORS[0]);
      setEditorPinned(false);
      setShowEditor(true);
    }
  }, [loaded, openDailyNote]);

  const openNew = () => {
    setEditingNote(null);
    setEditorTitle('');
    setEditorBody('');
    setEditorColor(NOTE_COLORS[0]);
    setEditorPinned(false);
    setShowEditor(true);
  };

  const openEdit = (note: Note) => {
    setEditingNote(note);
    setEditorTitle(note.title);
    setEditorBody(note.body);
    setEditorColor(note.color);
    setEditorPinned(note.pinned);
    setShowEditor(true);
  };

  const saveNote = useCallback(() => {
    if (!editorTitle.trim() && !editorBody.trim()) {
      setShowEditor(false);
      return;
    }
    const now = new Date().toISOString();
    if (editingNote) {
      setNotes(prev => prev.map(n => n.id === editingNote.id
        ? { ...n, title: editorTitle, body: editorBody, color: editorColor, pinned: editorPinned, updatedAt: now }
        : n
      ));
    } else {
      const note: Note = {
        id: String(Date.now()),
        title: editorTitle,
        body: editorBody,
        color: editorColor,
        pinned: editorPinned,
        createdAt: now,
        updatedAt: now,
      };
      setNotes(prev => [note, ...prev]);
    }
    setShowEditor(false);
  }, [editingNote, editorTitle, editorBody, editorColor, editorPinned]);

  const deleteNote = useCallback((id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id));
    setShowEditor(false);
  }, []);

  const togglePin = useCallback((id: string) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, pinned: !n.pinned } : n));
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return notes.filter(n =>
      !q || n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q)
    );
  }, [notes, search]);

  const pinned = filtered.filter(n => n.pinned);
  const unpinned = filtered.filter(n => !n.pinned);

  // 2-column masonry layout
  const toColumns = (items: Note[]): [Note[], Note[]] => {
    const left: Note[] = [];
    const right: Note[] = [];
    items.forEach((n, i) => (i % 2 === 0 ? left : right).push(n));
    return [left, right];
  };

  const accentForColor = (color: string) => {
    const idx = NOTE_COLORS.indexOf(color);
    return NOTE_ACCENT[idx] ?? '#00E5CC';
  };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      {/* Ambient glow */}
      <View style={s.glow} />

      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>Journal</Text>
        <Text style={s.subtitle}>{notes.length} {notes.length === 1 ? 'note' : 'notes'}</Text>
      </View>

      {/* Search */}
      <View style={s.searchRow}>
        <Ionicons name="search-outline" size={16} color="#2A5A60" style={{ marginRight: 8 }} />
        <TextInput
          style={s.searchInput}
          placeholder="Search notes…"
          placeholderTextColor="#1A3A40"
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={16} color="#2A5A60" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        {notes.length === 0 && (
          <View style={s.emptyState}>
            <View style={s.emptyIcon}>
              <Ionicons name="journal-outline" size={36} color="#00E5CC" />
            </View>
            <Text style={s.emptyTitle}>Your journal is empty</Text>
            <Text style={s.emptySubtitle}>Tap + to write your first note</Text>
          </View>
        )}

        {/* Pinned */}
        {pinned.length > 0 && (
          <>
            <Text style={s.sectionLabel}>PINNED</Text>
            <View style={s.grid}>
              {toColumns(pinned).map((col, ci) => (
                <View key={ci} style={s.col}>
                  {col.map(note => (
                    <NoteCard key={note.id} note={note} accent={accentForColor(note.color)} onPress={() => openEdit(note)} onPin={() => togglePin(note.id)} />
                  ))}
                </View>
              ))}
            </View>
          </>
        )}

        {/* Others */}
        {unpinned.length > 0 && (
          <>
            {pinned.length > 0 && <Text style={s.sectionLabel}>OTHERS</Text>}
            <View style={s.grid}>
              {toColumns(unpinned).map((col, ci) => (
                <View key={ci} style={s.col}>
                  {col.map(note => (
                    <NoteCard key={note.id} note={note} accent={accentForColor(note.color)} onPress={() => openEdit(note)} onPin={() => togglePin(note.id)} />
                  ))}
                </View>
              ))}
            </View>
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB */}
      <Animated.View style={[s.fab, { transform: [{ scale: fabAnim }] }]}>
        <TouchableOpacity style={s.fabInner} onPress={openNew} activeOpacity={0.85}>
          <Ionicons name="add" size={28} color="#000" />
        </TouchableOpacity>
      </Animated.View>

      {/* Editor modal */}
      <Modal visible={showEditor} animationType="slide" presentationStyle="fullScreen" onRequestClose={saveNote}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[s.editorContainer, { backgroundColor: editorColor }]}>
          <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
            {/* Editor toolbar */}
            <View style={s.editorToolbar}>
              <TouchableOpacity onPress={saveNote} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="arrow-back" size={22} color={accentForColor(editorColor)} />
              </TouchableOpacity>
              <View style={s.editorActions}>
                <TouchableOpacity
                  style={s.editorActionBtn}
                  onPress={() => setEditorPinned(p => !p)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name={editorPinned ? 'pin' : 'pin-outline'} size={20} color={editorPinned ? accentForColor(editorColor) : 'rgba(255,255,255,0.4)'} />
                </TouchableOpacity>
                {editingNote && (
                  <TouchableOpacity
                    style={s.editorActionBtn}
                    onPress={() => deleteNote(editingNote.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="trash-outline" size={20} color="rgba(255,255,255,0.4)" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Color picker */}
            <View style={s.colorRow}>
              {NOTE_COLORS.map((c, i) => (
                <TouchableOpacity
                  key={c}
                  style={[s.colorDot, { backgroundColor: NOTE_ACCENT[i] }, editorColor === c && s.colorDotActive]}
                  onPress={() => setEditorColor(c)}
                />
              ))}
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.editorScroll}>
              <TextInput
                style={s.editorTitle}
                placeholder="Title"
                placeholderTextColor="rgba(255,255,255,0.2)"
                value={editorTitle}
                onChangeText={setEditorTitle}
                multiline
                returnKeyType="next"
              />
              <TextInput
                style={s.editorBody}
                placeholder="Note…"
                placeholderTextColor="rgba(255,255,255,0.18)"
                value={editorBody}
                onChangeText={setEditorBody}
                multiline
                autoFocus={!editingNote}
                textAlignVertical="top"
              />
            </ScrollView>

            <View style={s.editorFooter}>
              <Text style={s.editorMeta}>
                {editingNote ? `Edited ${formatDate(editingNote.updatedAt)}` : 'New note'}
              </Text>
              <TouchableOpacity style={[s.editorSaveBtn, { backgroundColor: accentForColor(editorColor) }]} onPress={saveNote}>
                <Text style={s.editorSaveBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function NoteCard({ note, accent, onPress, onPin }: { note: Note; accent: string; onPress: () => void; onPin: () => void }) {
  const preview = note.body.slice(0, 120);
  return (
    <TouchableOpacity style={[ns.card, { backgroundColor: note.color, borderColor: accent + '30' }]} onPress={onPress} activeOpacity={0.8}>
      {note.pinned && (
        <View style={ns.pinBadge}>
          <Ionicons name="pin" size={10} color={accent} />
        </View>
      )}
      {note.title.length > 0 && (
        <Text style={[ns.title, { color: accent }]} numberOfLines={2}>{note.title}</Text>
      )}
      {preview.length > 0 && (
        <Text style={ns.body} numberOfLines={6}>{preview}</Text>
      )}
      <Text style={ns.date}>{formatDate(note.updatedAt)}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080E12' },
  glow: {
    position: 'absolute',
    top: -40, left: '20%',
    width: '60%', height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(0,229,204,0.06)',
  },

  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  title: { fontSize: 30, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: '#2A5A60', marginTop: 2 },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 16,
    backgroundColor: '#0D1C22',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: 'rgba(0,229,204,0.1)',
  },
  searchInput: { flex: 1, fontSize: 14, color: '#FFFFFF' },

  scroll: { paddingHorizontal: 12 },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2A5A60',
    letterSpacing: 1.5,
    marginBottom: 10,
    marginLeft: 4,
    marginTop: 4,
  },

  grid: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  col: { flex: 1, gap: 10 },

  emptyState: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(0,229,204,0.08)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(0,229,204,0.15)',
  },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: 'rgba(255,255,255,0.5)', marginBottom: 6 },
  emptySubtitle: { fontSize: 14, color: '#1A3A40' },

  fab: {
    position: 'absolute',
    bottom: 28, right: 24,
  },
  fabInner: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#00E5CC',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#00E5CC',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 8,
  },

  // Editor
  editorContainer: { flex: 1 },
  editorToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  editorActions: { flexDirection: 'row', gap: 16 },
  editorActionBtn: { padding: 4 },

  colorRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  colorDot: {
    width: 20, height: 20, borderRadius: 10,
    opacity: 0.55,
  },
  colorDotActive: {
    opacity: 1,
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },

  editorScroll: { paddingHorizontal: 20, paddingBottom: 24 },
  editorTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  editorBody: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 26,
    minHeight: 200,
  },

  editorFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  editorMeta: { fontSize: 12, color: 'rgba(255,255,255,0.25)' },
  editorSaveBtn: {
    paddingHorizontal: 20, paddingVertical: 9,
    borderRadius: 20,
  },
  editorSaveBtnText: { fontSize: 14, fontWeight: '700', color: '#000' },
});

const ns = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    marginBottom: 0,
  },
  pinBadge: {
    position: 'absolute',
    top: 10, right: 10,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: -0.2,
    paddingRight: 16,
  },
  body: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 19,
    marginBottom: 8,
  },
  date: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.25)',
    marginTop: 2,
  },
});
