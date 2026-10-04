import { ButtonLink, Card } from '../ui';
import { Page } from '../shell/page';
import { Stage } from '../shell/stage';

/** P10: any path the app does not know. */
export default function NotFoundPage() {
  return (
    <Page>
      <Stage>
        <Card
          title="A little lost?"
          description="We couldn’t find this page. There are still good games waiting for you."
          actions={<ButtonLink to="/">Back home</ButtonLink>}
        />
      </Stage>
    </Page>
  );
}
