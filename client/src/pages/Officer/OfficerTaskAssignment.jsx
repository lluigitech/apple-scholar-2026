import TaskAssignmentBoard from './TaskAssignment/TaskAssignmentBoard';

const OfficerTaskAssignment = () => {
  return (
    <TaskAssignmentBoard
      title="Officer Task Center"
      subtitle="Follow the submission process and review which scholars have passed their requirements"
      role="Officer"
      storageKey="officer-task-board"
      canManageTasks={false}
    />
  );
};

export default OfficerTaskAssignment;
