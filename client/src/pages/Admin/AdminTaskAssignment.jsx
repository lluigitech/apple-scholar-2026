import TaskAssignmentBoard from '../../components/shared/TaskAssignmentBoard';

const AdminTaskAssignment = () => {
  return (
    <TaskAssignmentBoard
      title="Task Assignment Center"
      subtitle="Track required scholar submissions and follow up on compliance progress"
      role="Admin"
      storageKey="admin-task-board"
      canManageTasks={false}
    />
  );
};

export default AdminTaskAssignment;