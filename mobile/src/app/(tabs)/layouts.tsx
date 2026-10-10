import { router } from "expo-router";
import { Screen, Footer } from "../../components/layout";
import {
  Badge,
  Body,
  Button,
  Card,
  CardGrid,
  CardTitle,
} from "../../components/ui";

export default function LayoutsScreen() {
  return (
    <Screen
      title="Layout shells"
      description="A place for your brand, navigation, content, and the links people need later."
    >
      <CardGrid>
        <Card>
          <Badge>Navigation bar</Badge>
          <CardTitle>Your product, in view.</CardTitle>
          <Body>
            The bar above includes the brand and page title. Open navigation to
            choose a section; selecting one closes the drawer.
          </Body>
          <Button
            label="Explore cards"
            onPress={() => router.navigate("/cards")}
          />
        </Card>
        <Card>
          <Badge>Sidebar + tabs</Badge>
          <CardTitle>Keep the next step close.</CardTitle>
          <Body>
            The navigation drawer provides full section names. Bottom tabs keep
            common destinations within thumb’s reach.
          </Body>
          <Body>
            All controls have accessible labels and touch targets of at least 44
            points.
          </Body>
        </Card>
        <Card>
          <Badge>Footer</Badge>
          <CardTitle>A quiet place for links.</CardTitle>
          <Body>
            Secondary actions stay at the end of the content. The screen scrolls
            and the tab bar respects the home indicator.
          </Body>
          <Footer />
        </Card>
      </CardGrid>
    </Screen>
  );
}
