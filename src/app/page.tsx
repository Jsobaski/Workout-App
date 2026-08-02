"use client";

import { useState } from "react";
import DayNav from "@/components/DayNav";
import NutritionSection from "@/components/NutritionSection";
import WorkoutSection from "@/components/WorkoutSection";
import AddFoodModal from "@/components/AddFoodModal";
import LogWorkoutModal from "@/components/LogWorkoutModal";
import SuggestWorkoutModal from "@/components/SuggestWorkoutModal";
import { useDayData } from "@/hooks/useDayData";
import { useCoachingContext } from "@/hooks/useCoachingContext";
import { useExerciseNames } from "@/hooks/useExerciseNames";
import { useRecentFoods } from "@/hooks/useRecentFoods";
import { todayKey } from "@/lib/date";
import { SuggestedExercise, WorkoutSuggestion } from "@/lib/types";
import { inferMuscleGroups } from "@/lib/muscleGroups";

export default function DayViewPage() {
  const [dateKey, setDateKey] = useState(todayKey());
  const {
    foodEntries,
    workoutEntries,
    addFoodEntry,
    updateFoodEntry,
    removeFoodEntry,
    addWorkoutEntry,
    updateWorkoutEntry,
    removeWorkoutEntry,
  } = useDayData(dateKey);
  const { context: coachingContext } = useCoachingContext();
  const exerciseNames = useExerciseNames(workoutEntries.length);
  const recentFoods = useRecentFoods(foodEntries.length);

  const [showAddFood, setShowAddFood] = useState(false);
  const [showLogWorkout, setShowLogWorkout] = useState(false);
  const [showSuggest, setShowSuggest] = useState(false);
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
        entries={workoutEntries}
        onAdd={() => setShowLogWorkout(true)}
        onSuggest={() => setShowSuggest(true)}
        onUpdate={updateWorkoutEntry}
        onDelete={removeWorkoutEntry}
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

      {showSuggest && (
        <SuggestWorkoutModal
          coachingContext={coachingContext}
          cached={workoutSuggestion}
          addedNames={addedSuggestionNames}
          onClose={() => setShowSuggest(false)}
          onLoaded={handleSuggestionLoaded}
          onAdd={handleAddSuggested}
        />
      )}
    </div>
  );
}
