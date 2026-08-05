import TaskAssignmentBoard from '../../components/shared/TaskAssignmentBoard';

const AdminTaskAssignment = () => {
  return (
    <TaskAssignmentBoard
      title="Task Assignment Center"
      subtitle="Track required scholar submissions and create follow-up tasks"
      role="Admin"
      storageKey="admin-task-board"
    />
  );
};

export default AdminTaskAssignment;