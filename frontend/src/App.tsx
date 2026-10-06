import { RouterProvider } from "react-router-dom"
import router from "./router"
import { registerNavigator } from "./utils/navigation"

// Register the global router navigator
registerNavigator((path: string) => {
  router.navigate(path)
})

export default function App() {
  return <RouterProvider router={router} />
}
