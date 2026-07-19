import { useParams } from 'react-router-dom';
import { ProfileForm } from './ProfileForm.js';

export function CreateProfilePage(): JSX.Element {
  const { profileId } = useParams<{ profileId: string }>();
  const isEditing = Boolean(profileId);

  return (
    <ProfileForm
      mode={isEditing ? 'edit' : 'create'}
      profileId={profileId}
    />
  );
}
