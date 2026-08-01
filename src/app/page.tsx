"use client";

import { useState } from "react";
import DayNav from "@/components/DayNav";
import NutritionSection from "@/components/NutritionSection";
import WorkoutSection from "@/components/WorkoutSection";
import AddFoodModal from "@/components/AddFoodModal";
import LogWorkoutModal, { WorkoutPrefill } from "@/components/LogWorkoutModal";
import SuggestWorkoutModal from "@/components/SuggestWorkoutModal";
import { useDayData } from "@/hooks/useDayData";
import { useCoachingContext } from "@/hooks/useCoachingContext";
import { useExerciseNames } from "@/hooks/useExerciseNames";
import { todayKey } from "@/lib/date";
import { SuggestedExercise } from "@/lib/types";

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

  const [showAddFood, setShowAddFood] = useState(false);
  const [showLogWorkout, setShowLogWorkout] = useState(false);
  const [showSuggest, setShowSuggest] = useState(false);
  const [workoutPrefill, setWorkoutPrefill] = useState<WorkoutPrefill | undefined>();

  function handlePickSuggestion(exercise: SuggestedExercise) {
    setWorkoutPrefill({
      exerciseName: exercise.name,
      sets: Array.from({ length: exercise.sets }, () => ({
        reps: exercise.reps,
        weight: exercise.weight,
      })),
      caution: exercise.caution,
    });
    setShowSuggest(false);
    setShowLogWorkout(true);
  }

  return (
    <div className="space-y-4">
      <DayNav dateKey={dateKey} onChange={setDateKey} />

      <WorkoutSection
        entries={workoutEntries}
        onAdd={() => {
          setWorkoutPrefill(undefined);
          setShowLogWorkout(true);
        }}
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
          onClose={() => setShowAddFood(false)}
          onSave={addFoodEntry}
        />
      )}

      {showLogWorkout && (
        <LogWorkoutModal
          exerciseNames={exerciseNames}
          prefill={workoutPrefill}
          onClose={() => {
            setShowLogWorkout(false);
            setWorkoutPrefill(undefined);
          }}
          onSave={addWorkoutEntry}
        />
      )}

      {showSuggest && (
        <SuggestWorkoutModal
          coachingContext={coachingContext}
          onClose={() => setShowSuggest(false)}
          onPickExercise={handlePickSuggestion}
        />
      )}
    </div>
  );
}
