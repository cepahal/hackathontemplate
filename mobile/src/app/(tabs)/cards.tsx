import { router } from "expo-router";
import { Screen } from "../../components/layout";
import {
  Badge,
  Body,
  Button,
  Card,
  CardGrid,
  CardTitle,
  EmptyState,
  Loading,
} from "../../components/ui";

export default function CardsScreen() {
  return (
    <Screen
      title="Card containers"
      description="Reusable containers for content, actions, and the space between them. These are local UI previews."
    >
      <CardGrid>
        <Card>
          <Badge>Content card</Badge>
          <CardTitle>Start with something useful.</CardTitle>
          <Body>
            A clear title, helpful context, and one next action. Add your own
            content and let the card grow with it.
          </Body>
          <Button
            label="Try the states"
            onPress={() => router.navigate("/states")}
          />
        </Card>
        <Card>
          <CardTitle>A softer starting point</CardTitle>
          <EmptyState
            title="Nothing here yet"
            action={
              <Button
                label="Explore feedback"
                variant="outline"
                onPress={() => router.navigate("/states")}
              />
            }
          >
            Use a helpful prompt to invite the first action.
          </EmptyState>
        </Card>
        <Card>
          <CardTitle>While you wait</CardTitle>
          <Body>Keep the layout steady while content arrives.</Body>
          <Loading label="Loading preview…" />
          <Body>Static loading example</Body>
        </Card>
      </CardGrid>
    </Screen>
  );
}
