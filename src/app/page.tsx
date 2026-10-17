"use client";

import { useEffect, useState } from "react";
import DayNav from "@/components/DayNav";
import NutritionSection from "@/components/NutritionSection";
import WorkoutSection from "@/components/WorkoutSection";
import GolfActivitySection from "@/components/GolfActivitySection";
import AddFoodModal from "@/components/AddFoodModal";
import LogWorkoutModal from "@/components/LogWorkoutModal";
import { getSavedPin } from "@/lib/appPin";
import SuggestWorkoutModal from "@/components/SuggestWorkoutModal";
import WorkoutSplitModal from "@/components/WorkoutSplitModal";
import LogGolfActivityModal from "@/components/LogGolfActivityModal";
import { useDayData } from "@/hooks/useDayData";
import { useCoachingContext } from "@/hooks/useCoachingContext";
import { useExerciseNames } from "@/hooks/useExerciseNames";
import { useRecentFoods } from "@/hooks/useRecentFoods";
import { useFoodHistory } from "@/hooks/useFoodHistory";
import { todayKey } from "@/lib/date";
import { SuggestedExercise, WorkoutSuggestion } from "@/lib/types";
import { inferMuscleGroups } from "@/lib/muscleGroups";

export default function DayViewPage() {
  const [dateKey, setDateKey] = useState(todayKey());
  const {
    foodEntries,
    workoutEntries,
    golfActivityEntries,
    addFoodEntry,
    updateFoodEntry,
    removeFoodEntry,
    addWorkoutEntry,
    updateWorkoutEntry,
    removeWorkoutEntry,
    addGolfActivityEntry,
    removeGolfActivityEntry,
  } = useDayData(dateKey);
  const { context: coachingContext } = useCoachingContext();
  const exerciseNames = useExerciseNames(workoutEntries.length);
  const recentFoods = useRecentFoods(foodEntries.length);
  const foodHistory = useFoodHistory(foodEntries.length);

  const [showAddFood, setShowAddFood] = useState(false);
  const [showLogWorkout, setShowLogWorkout] = useState(false);
  const [showSuggest, setShowSuggest] = useState(false);
  const [aiUnlocked, setAiUnlocked] = useState(false);

  useEffect(() => {
    (async () => {
      setAiUnlocked(getSavedPin() !== null);
    })();
  }, []);
  const [showChooseSplit, setShowChooseSplit] = useState(false);
  const [showLogGolfActivity, setShowLogGolfActivity] = useState(false);
  const [workoutSuggestion, setWorkoutSuggestion] = useState<WorkoutSuggestion | null>(null);
  const [addedSuggestionNames, setAddedSuggestionNames] = useState<Set<string>>(new Set());

  function handleSuggestionLoaded(suggestion: WorkoutSuggestion) {
    setWorkoutSuggestion(suggestion);
    setAddedSuggestionNames(new Set());
  }

  async function handleAddSuggested(exercise: SuggestedExercise) {
    await addWorkoutEntry({
      timestamp: Date.now(),
      exerciseName: exercise.name,
      muscleGroups:
        exercise.muscleGroups && exercise.muscleGroups.length > 0
          ? exercise.muscleGroups
          : inferMuscleGroups(exercise.name),
      sets: Array.from({ length: Math.max(1, exercise.sets) }, () => ({
        reps: exercise.reps,
        weight: exercise.weight,
      })),
    });
    setAddedSuggestionNames((prev) => new Set(prev).add(exercise.name));
  }

  return (
    <div className="space-y-4">
      <DayNav dateKey={dateKey} onChange={setDateKey} />

      <WorkoutSection
        dateKey={dateKey}
        entries={workoutEntries}
        onAdd={() => setShowLogWorkout(true)}
        onSuggest={() => setShowSuggest(true)}
        canSuggest={aiUnlocked}
        onChooseSplit={() => setShowChooseSplit(true)}
        onUpdate={updateWorkoutEntry}
        onDelete={removeWorkoutEntry}
      />

      <GolfActivitySection
        entries={golfActivityEntries}
        onAdd={() => setShowLogGolfActivity(true)}
        onDelete={removeGolfActivityEntry}
      />

      <NutritionSection
        entries={foodEntries}
        targetCalories={[
          coachingContext.calorieTargetLow,
          coachingContext.calorieTargetHigh,
        ]}
        targetProtein={coachingContext.proteinTargetG}
        onAdd={() => setShowAddFood(true)}
        onUpdate={updateFoodEntry}
        onDelete={removeFoodEntry}
      />

      {showAddFood && (
        <AddFoodModal
          recentFoods={recentFoods}
          foodHistory={foodHistory}
          onClose={() => setShowAddFood(false)}
          onSave={addFoodEntry}
        />
      )}

      {showLogWorkout && (
        <LogWorkoutModal
          exerciseNames={exerciseNames}
          onClose={() => setShowLogWorkout(false)}
          onSave={addWorkoutEntry}
        />
      )}

      {showChooseSplit && (
        <WorkoutSplitModal
          onClose={() => setShowChooseSplit(false)}
          onSave={addWorkoutEntry}
        />
      )}

      {showLogGolfActivity && (
        <LogGolfActivityModal
          onClose={() => setShowLogGolfActivity(false)}
          onSave={addGolfActivityEntry}
        />
      )}

      {showSuggest && (
        <SuggestWorkoutModal
          coachingContext={coachingContext}
          cached={workoutSuggestion}
          addedNames={addedSuggestionNames}
          onClose={() => setShowSuggest(false)}
          onLoaded={handleSuggestionLoaded}
          onAdd={handleAddSuggested}
          onLocked={() => setAiUnlocked(false)}
        />
      )}
    </div>
  );
}
