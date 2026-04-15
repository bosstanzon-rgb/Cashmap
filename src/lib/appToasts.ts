import { Alert, Platform, ToastAndroid } from "react-native";

export const showSuccessToast = (message: string, title = "CashMap") => {
  if (Platform.OS === "android") {
    ToastAndroid.show(message, ToastAndroid.LONG);
  } else {
    Alert.alert(title, message);
  }
};

export const showErrorAlert = (title: string, message: string) => {
  Alert.alert(title, message);
};
