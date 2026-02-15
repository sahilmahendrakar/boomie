import { Timestamp } from "firebase-admin/firestore";

import { USER_GOAL_OPTIONS, type UserGoalId } from "@/lib/user-goals/constants";

export type UserGoalsInput = {
  selectedGoals: UserGoalId[];
  notes: string;
};

export type UserGoalsFirestoreDoc = UserGoalsInput & {
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type UserGoals = UserGoalsInput & {
  createdAt: string;
  updatedAt: string;
};

export function toUserGoals(doc: UserGoalsFirestoreDoc): UserGoals {
  return {
    selectedGoals: doc.selectedGoals,
    notes: doc.notes,
    createdAt: doc.createdAt.toDate().toISOString(),
    updatedAt: doc.updatedAt.toDate().toISOString(),
  };
}

export function getUserGoalLabel(goalId: UserGoalId): string {
  const option = USER_GOAL_OPTIONS.find((candidate) => candidate.id === goalId);
  return option?.label ?? goalId;
}
