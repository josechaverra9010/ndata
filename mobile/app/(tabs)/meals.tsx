import { useCallback, useState } from 'react';

import {

  Alert,

  Image,

  Modal,

  Pressable,

  RefreshControl,

  ScrollView,

  StyleSheet,

  Text,

  View,

} from 'react-native';

import { useFocusEffect } from '@react-navigation/native';

import * as ImagePicker from 'expo-image-picker';

import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '@/src/context/AuthContext';

import { analyzeMealPhoto, apiFetch, type MealPhotoAnalysis } from '@/src/lib/api';

import { todayInColombiaISO } from '@/src/lib/timezone';

import { Card, ProgressBar } from '@/src/components/Ui';

import { EmptyState, LoadingView } from '@/src/components/Feedback';

import { colors } from '@/src/theme/colors';



interface FoodItem {

  name: string;

  portion: string;

  calories: number;

  checked: boolean;

}



interface Meal {

  id: string;

  name: string;

  time: string;

  completed: boolean;

  foods: FoodItem[];

  total_calories: number;

}



interface MealsData {

  meals: Meal[];

  summary: {

    calories: { consumed: number; target: number };

    protein: { consumed: number; target: number };

  };

  message?: string;

}



const MEAL_TYPES = [

  { id: 'breakfast', label: 'Desayuno' },

  { id: 'morning_snack', label: 'Snack mañana' },

  { id: 'lunch', label: 'Almuerzo' },

  { id: 'afternoon_snack', label: 'Snack tarde' },

  { id: 'dinner', label: 'Cena' },

];



export default function MealsScreen() {

  const { user } = useAuth();

  const patientId = user?.id;

  const [data, setData] = useState<MealsData | null>(null);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [initializing, setInitializing] = useState(false);

  const [analyzing, setAnalyzing] = useState(false);

  const [selectedMealType, setSelectedMealType] = useState('lunch');

  const [previewUri, setPreviewUri] = useState<string | null>(null);

  const [analysis, setAnalysis] = useState<MealPhotoAnalysis | null>(null);

  const [showAnalysis, setShowAnalysis] = useState(false);



  const load = useCallback(async () => {

    if (!patientId) return;

    try {

      const res = await apiFetch<MealsData>(`/patient/${patientId}/meals/today/detailed`);

      setData(res);

    } catch {

      setData(null);

    } finally {

      setLoading(false);

      setRefreshing(false);

    }

  }, [patientId]);



  useFocusEffect(

    useCallback(() => {

      setLoading(true);

      load();

    }, [load])

  );



  const initMeals = async () => {

    if (!patientId) return;

    setInitializing(true);

    try {

      await apiFetch(`/patient/${patientId}/meals/initialize`, {

        method: 'POST',

        body: JSON.stringify({ date: todayInColombiaISO() }),

      });

      await load();

    } catch {

      Alert.alert('Error', 'No se pudieron inicializar las comidas');

    } finally {

      setInitializing(false);

    }

  };



  const toggleFood = async (mealType: string, foodName: string, checked: boolean) => {

    if (!patientId) return;

    try {

      await apiFetch(`/patient/${patientId}/meals/food/toggle`, {

        method: 'POST',

        body: JSON.stringify({

          meal_type: mealType,

          food_name: foodName,

          date: todayInColombiaISO(),

        }),

      });

      await load();

    } catch {

      Alert.alert('Error', 'No se pudo actualizar el alimento');

    }

  };



  const pickPhoto = async (useCamera: boolean) => {

    if (!patientId) return;

    const permission = useCamera

      ? await ImagePicker.requestCameraPermissionsAsync()

      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {

      Alert.alert('Permiso requerido', 'Necesitamos acceso a la cámara o galería.');

      return;

    }



    const result = useCamera

      ? await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true, aspect: [4, 3] })

      : await ImagePicker.launchImageLibraryAsync({ quality: 0.7, allowsEditing: true, aspect: [4, 3] });



    if (result.canceled || !result.assets?.[0]?.uri) return;



    const uri = result.assets[0].uri;

    setPreviewUri(uri);

    setAnalyzing(true);

    setAnalysis(null);

    setShowAnalysis(true);



    try {

      const res = await analyzeMealPhoto(patientId, uri, selectedMealType, true);

      setAnalysis(res.analysis);

      await load();

      Alert.alert(

        'Análisis listo',

        res.added_to_meal

          ? 'Los alimentos detectados se añadieron a tu comida del día.'

          : 'No se detectaron alimentos claros en la foto.'

      );

    } catch (err: unknown) {

      const msg = err instanceof Error ? err.message : 'No se pudo analizar la foto';

      Alert.alert('Error', msg);

      setShowAnalysis(false);

    } finally {

      setAnalyzing(false);

    }

  };



  const openPhotoOptions = () => {

    Alert.alert('Foto de comida', 'Toma una foto del plato para estimar calorías y macros con IA.', [

      { text: 'Cámara', onPress: () => pickPhoto(true) },

      { text: 'Galería', onPress: () => pickPhoto(false) },

      { text: 'Cancelar', style: 'cancel' },

    ]);

  };



  if (loading && !data) return <LoadingView message="Cargando comidas…" />;



  const pct =

    data?.summary?.calories?.target

      ? Math.round((data.summary.calories.consumed / data.summary.calories.target) * 100)

      : 0;



  return (

    <>

      <ScrollView

        style={styles.scroll}

        contentContainerStyle={styles.content}

        refreshControl={

          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />

        }

      >

        <Card style={styles.aiCard}>

          <View style={styles.aiHeader}>

            <Ionicons name="camera" size={22} color={colors.primary} />

            <Text style={styles.aiTitle}>¿Comiste algo diferente?</Text>

          </View>

          <Text style={styles.muted}>

            Toma una foto del plato y la IA estimará calorías, proteínas, carbohidratos y grasas.

          </Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>

            {MEAL_TYPES.map((m) => (

              <Pressable

                key={m.id}

                style={[styles.chip, selectedMealType === m.id && styles.chipOn]}

                onPress={() => setSelectedMealType(m.id)}

              >

                <Text style={[styles.chipText, selectedMealType === m.id && styles.chipTextOn]}>{m.label}</Text>

              </Pressable>

            ))}

          </ScrollView>

          <Pressable style={styles.photoBtn} onPress={openPhotoOptions} disabled={analyzing}>

            <Ionicons name="sparkles" size={18} color="#fff" />

            <Text style={styles.photoBtnText}>{analyzing ? 'Analizando…' : 'Analizar foto con IA'}</Text>

          </Pressable>

        </Card>



        {data?.summary ? (

          <Card>

            <Text style={styles.cardTitle}>Resumen del día</Text>

            <Text style={styles.big}>

              {data.summary.calories.consumed} / {data.summary.calories.target} kcal

            </Text>

            <ProgressBar value={pct} />

            <Text style={styles.muted}>

              Proteína: {Math.round(data.summary.protein.consumed)}g / {Math.round(data.summary.protein.target)}g

            </Text>

          </Card>

        ) : null}



        {!data?.meals?.length ? (

          <EmptyState

            title="Sin comidas hoy"

            subtitle={data?.message || 'Inicializa el plan del día o registra una foto de lo que comiste.'}

          />

        ) : (

          data.meals.map((meal) => (

            <Card key={meal.id} style={styles.mealBlock}>

              <View style={styles.mealHeader}>

                <Text style={styles.mealTitle}>{meal.name}</Text>

                <Text style={styles.muted}>{meal.time} · {meal.total_calories} kcal</Text>

              </View>

              {meal.foods.map((food) => (

                <Pressable

                  key={`${meal.id}-${food.name}`}

                  style={styles.foodRow}

                  onPress={() => toggleFood(meal.id, food.name, food.checked)}

                >

                  <View style={[styles.dot, food.checked && styles.dotOn]} />

                  <View style={{ flex: 1 }}>

                    <Text style={[styles.foodName, food.checked && styles.foodDone]}>{food.name}</Text>

                    <Text style={styles.muted}>{food.portion} · {food.calories} kcal</Text>

                  </View>

                </Pressable>

              ))}

            </Card>

          ))

        )}



        {!data?.meals?.length ? (

          <Pressable style={styles.initBtn} onPress={initMeals} disabled={initializing}>

            <Text style={styles.initText}>{initializing ? 'Inicializando…' : 'Inicializar comidas de hoy'}</Text>

          </Pressable>

        ) : null}

      </ScrollView>



      <Modal visible={showAnalysis} transparent animationType="slide" onRequestClose={() => setShowAnalysis(false)}>

        <View style={styles.modalBackdrop}>

          <View style={styles.modalCard}>

            <Text style={styles.modalTitle}>Análisis nutricional</Text>

            {previewUri ? (

              <Image source={{ uri: previewUri }} style={styles.preview} resizeMode="cover" />

            ) : null}

            {analyzing ? (

              <Text style={styles.muted}>La IA está estimando calorías y macronutrientes…</Text>

            ) : analysis ? (

              <ScrollView style={{ maxHeight: 260 }}>

                {analysis.description ? (

                  <Text style={styles.analysisDesc}>{analysis.description}</Text>

                ) : null}

                {analysis.foods.map((food) => (

                  <View key={food.name} style={styles.analysisRow}>

                    <Text style={styles.foodName}>{food.name}</Text>

                    <Text style={styles.muted}>

                      {food.portion_size} · {food.calories} kcal · P {food.protein}g · C {food.carbs}g · G {food.fat}g

                    </Text>

                  </View>

                ))}

                <Text style={styles.total}>

                  Total: {analysis.totals.calories} kcal · P {analysis.totals.protein}g · C {analysis.totals.carbs}g · G {analysis.totals.fat}g

                </Text>

                {analysis.notes ? <Text style={styles.muted}>{analysis.notes}</Text> : null}

              </ScrollView>

            ) : null}

            <Pressable style={styles.closeBtn} onPress={() => setShowAnalysis(false)}>

              <Text style={styles.closeBtnText}>Cerrar</Text>

            </Pressable>

          </View>

        </View>

      </Modal>

    </>

  );

}



const styles = StyleSheet.create({

  scroll: { flex: 1, backgroundColor: colors.background },

  content: { padding: 16, gap: 12, paddingBottom: 32 },

  aiCard: { gap: 10 },

  aiHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  aiTitle: { fontSize: 16, fontWeight: '700', color: colors.text },

  cardTitle: { fontWeight: '700', fontSize: 15, color: colors.text },

  big: { fontSize: 22, fontWeight: '800', color: colors.text, marginVertical: 8 },

  muted: { color: colors.muted, fontSize: 12, marginTop: 4 },

  mealBlock: { gap: 8 },

  mealHeader: { marginBottom: 4 },

  mealTitle: { fontSize: 16, fontWeight: '700', color: colors.text },

  foodRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },

  dot: {

    width: 22,

    height: 22,

    borderRadius: 11,

    borderWidth: 2,

    borderColor: colors.border,

  },

  dotOn: { backgroundColor: colors.primary, borderColor: colors.primary },

  foodName: { fontWeight: '600', color: colors.text },

  foodDone: { textDecorationLine: 'line-through', color: colors.muted },

  initBtn: {

    backgroundColor: colors.primary,

    borderRadius: 12,

    padding: 14,

    alignItems: 'center',

  },

  initText: { color: '#fff', fontWeight: '700' },

  chips: { marginVertical: 4 },

  chip: {

    borderWidth: 1,

    borderColor: colors.border,

    borderRadius: 999,

    paddingHorizontal: 12,

    paddingVertical: 6,

    marginRight: 8,

  },

  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },

  chipText: { fontSize: 12, color: colors.text, fontWeight: '600' },

  chipTextOn: { color: '#fff' },

  photoBtn: {

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'center',

    gap: 8,

    backgroundColor: colors.primary,

    borderRadius: 12,

    paddingVertical: 12,

  },

  photoBtnText: { color: '#fff', fontWeight: '700' },

  modalBackdrop: {

    flex: 1,

    backgroundColor: 'rgba(0,0,0,0.45)',

    justifyContent: 'flex-end',

  },

  modalCard: {

    backgroundColor: colors.card,

    borderTopLeftRadius: 20,

    borderTopRightRadius: 20,

    padding: 20,

    gap: 12,

    maxHeight: '85%',

  },

  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.text },

  preview: { width: '100%', height: 180, borderRadius: 12 },

  analysisDesc: { color: colors.text, marginBottom: 8 },

  analysisRow: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },

  total: { fontWeight: '700', color: colors.primary, marginTop: 8 },

  closeBtn: {

    backgroundColor: colors.background,

    borderRadius: 12,

    padding: 12,

    alignItems: 'center',

  },

  closeBtnText: { fontWeight: '700', color: colors.text },

});


