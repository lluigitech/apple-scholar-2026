import TaskAssignmentBoard from '../../components/shared/TaskAssignmentBoard';

const OfficerTaskAssignment = () => {
  return (
    <TaskAssignmentBoard
      title="Officer Task Center"
      subtitle="Review submission progress and manage compliance follow-up tasks"
      role="Officer"
      storageKey="officer-task-board"
      canManageTasks={true}
    />
  );
};

export default OfficerTaskAssignment;
