import { useState, useEffect } from "react";
import SplashScreen from "@/components/SplashScreen";
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { Redirect, Route, Switch, Router as WouterRouter } from "wouter";
import CustomerPage  from "@/pages/CustomerPage";
import ReceptionPage from "@/pages/ReceptionPage";
import DeliveryPage  from "@/pages/DeliveryPage";
import CouponsPage   from "@/pages/CouponsPage";
import SettingsPage  from "@/pages/SettingsPage";
import { getCustomer } from "./lib/customerAuth";
import AboutPage from "@/pages/AboutPage";
import ContactPage from "@/pages/ContactPage";
import PrivacyPage from "@/pages/PrivacyPage";
import TermsPage from "@/pages/TermsPage";
import MoreMenu from "@/pages/MoreMenu";
const BUILD_TARGET = import.meta.env.VITE_BUILD_TARGET as

  | "client"
  | "admin"
  | "delivery"
  | undefined;

function Router() {
  useEffect(() => {
    const setupPush = async () => {
      if (!Capacitor.isNativePlatform()) return;
      let perm = await PushNotifications.checkPermissions();
      if (perm.receive === 'prompt') {
        perm = await PushNotifications.requestPermissions();
      }
      if (perm.receive !== 'granted') return;
      await PushNotifications.register();
      PushNotifications.addListener('registration', (token: any) => {
        console.log('TOKEN:', token.value);
      });
    };
    setupPush();
  }, []);
  if (BUILD_TARGET === "admin") {
    return (
      <Switch>
        <Route path="/" component={ReceptionPage} />
        <Route path="/admin/orders" component={ReceptionPage} />
        <Route path="/admin/coupons" component={CouponsPage} />
        <Route path="/admin/settings" component={SettingsPage} />
        <Route component={ReceptionPage} />
      </Switch>
    );
  }

  if (BUILD_TARGET === "delivery") {
    return (
      <Switch>
        
        <Route path="/" component={DeliveryPage} />
        <Route path="/delivery" component={DeliveryPage} />
        <Route component={DeliveryPage} />
      </Switch>
    );
  }

if (BUILD_TARGET === "client") {
  return (
    <Switch>
      <Route path="/" component={CustomerPage} />
      <Route path="/client" component={CustomerPage} />
      <Route path="/about" component={AboutPage} />
      <Route path="/contact" component={ContactPage} />
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/terms" component={TermsPage} />
      <Route path="/more" component={MoreMenu} />
      <Route component={CustomerPage} />


    </Switch>
  );
}
  return (
    <Switch>
      <Route path="/" component={CustomerPage} />
      <Route path="/client" component={CustomerPage} />
      <Route path="/about" component={AboutPage} />
      <Route path="/contact" component={ContactPage} />
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/terms" component={TermsPage} />
      <Route path="/more" component={MoreMenu} />
      <Route path="/admin/orders" component={ReceptionPage} />
      <Route path="/admin/coupons" component={CouponsPage} />
      <Route path="/admin/settings" component={SettingsPage} />
      <Route path="/admin">
        <Redirect to="/admin/orders" />
      </Route>
      <Route path="/delivery" component={DeliveryPage} />
      <Route component={CustomerPage} />
    </Switch>
  );
}
export default function App() {
  const [showSplash, setShowSplash] = useState(false);
  const isAdminRoute = window.location.pathname.startsWith("/admin") || window.location.pathname.startsWith("/delivery");
  const needLogin = !isAdminRoute && !getCustomer();

  return (
    <>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <Router />
      </WouterRouter>
    </>
  );
}