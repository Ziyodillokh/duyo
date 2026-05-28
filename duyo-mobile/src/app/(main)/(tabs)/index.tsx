import { ChildHome } from '@/screens/home/child-home';
import { CompanionHome } from '@/screens/home/companion-home';
import { JuniorHome } from '@/screens/home/junior-home';
import { useChildStore } from '@/store/child';

const JUNIOR_MAX_AGE = 10;
const CHILD_MAX_AGE = 13;

export default function HomeScreen() {
  const age = useChildStore((s) => s.child?.age ?? JUNIOR_MAX_AGE);

  if (age <= JUNIOR_MAX_AGE) {
    return <JuniorHome />;
  }
  if (age <= CHILD_MAX_AGE) {
    return <ChildHome />;
  }
  return <CompanionHome />;
}
