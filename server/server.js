import express from "express";
import fetch from "node-fetch";
import "dotenv/config";

//Se cargan las variables de entorno que contienen el client id y client secret
const { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PORT = 8888 } = process.env;
// URL base para hacer pruebas en el sandbox de paypal
const base = "https://sandbox.paypal.com";
//Instanciamos express 
const app = express();

//Configuracion para que pueda reconocer el mjs
app.set("view engine", "ejs");
app.set("views", "./server/views");

// host static files
app.use(express.static("client"));

// parseamos los datos que nos lleguen por post params y lo enviamos en el body en un formato json
app.use(express.json());

// Funcion para generar un token de acceso
const generateAccessToken = async () => {
  
  //Intentamos obtener el id del cliente y el secret
  try {
    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {

      //Si no se exiten lanzamos un error de que faltan estas credenciales para autenticarnos con la api
      throw new Error("MISSING_API_CREDENTIALS");
    }
    //Con buffer que se encargara de trabajar con archivos binarios como base 64, lo utilizamos para encodearlos 
    const auth = Buffer.from(
      PAYPAL_CLIENT_ID + ":" + PAYPAL_CLIENT_SECRET,
    ).toString("base64");

    // Hacemos la solicitud y esperamos el resultado
    const response = await fetch(`${base}/v1/oauth2/token`, {
      //la solicitud sera por post para obtener un token de acceso
      method: "POST",
      //especificacion de que queremos que nos devuelva el servidor
      body: "grant_type=client_credentials",
      headers: {
        //Pasamos el auth con el paypal id client y secret para hacer la solicitud y obtener un token de acceso
        Authorization: `Basic ${auth}`
      },
    });

    //Esperamos la respuesta del servidor de la autorizacion
    const data = await response.json();
    
    console.log(`Data recibida al autenticarnos ${data} `)
    
    //Retornamos el token de accesso
    return data.access_token;

  } catch (error) {

    //Cacheamos el error si ocurrio alguno inesperado en la solicitud como un invalid client etc
    console.log("Failed to generate Access Token:", error);
  }
};



// Funcion para crear una orden
const createOrder = async (cart) => {
  // use the cart information passed from the front-end to calculate the purchase unit details

  // Espera que se genere el token para poder colocarlo y hacer la solicitud para crear al orden directamente
  const accessToken = await generateAccessToken();
  console.log(`Informacion Generada ${accessToken}`)
  // URL de la api de paypal a la que se le hara la solicitud para crear una orden de suscripcion
  const url = `${base}/v2/checkout/orders`;

  const payload = {
    intent: "CAPTURE",
    purchase_units: [
      {
        amount: {
          currency_code: "USD",
          value: "100.00",
        },
      },
    ],
  };

  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      // Uncomment one of these to force an error for negative testing (in sandbox mode only). Documentation:
      // https://developer.paypal.com/tools/sandbox/negative-testing/request-headers/
      // "PayPal-Mock-Response": '{"mock_application_codes": "MISSING_REQUIRED_PARAMETER"}'
      // "PayPal-Mock-Response": '{"mock_application_codes": "PERMISSION_DENIED"}'
      // "PayPal-Mock-Response": '{"mock_application_codes": "INTERNAL_SERVER_ERROR"}'
    },
    method: "POST",
    body: JSON.stringify(payload),
  });

  return handleResponse(response);
};


//Captura la orden generada por el id que genera el create order
const captureOrder = async (orderID) => {
  const accessToken = await generateAccessToken();
  const url = `${base}/v2/checkout/orders/${orderID}/capture`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      // Uncomment one of these to force an error for negative testing (in sandbox mode only). Documentation:
      // https://developer.paypal.com/tools/sandbox/negative-testing/request-headers/
      // "PayPal-Mock-Response": '{"mock_application_codes": "INSTRUMENT_DECLINED"}'
      // "PayPal-Mock-Response": '{"mock_application_codes": "TRANSACTION_REFUSED"}'
      // "PayPal-Mock-Response": '{"mock_application_codes": "INTERNAL_SERVER_ERROR"}'
    },
  });

  return handleResponse(response);
};

// Handlea las respuestas de las demas respuestas http
async function handleResponse(response) {
  try {
    const jsonResponse = await response.json();
    return {
      jsonResponse,
      httpStatusCode: response.status,
    };
  } catch (err) {
    const errorMessage = await response.text();
    throw new Error(errorMessage);
  }
}

app.get("/api", async (req,res) =>{

  res.send({"Hola":"hOLAD"})
})

// ******* Rutas propias del servidor endpoints perced que tendra ******

//Endpoint propio para gestionar las ordenes es decir crearlas
app.post("/api/orders", async (req, res) => {
  try {
    // use the cart information passed from the front-end to calculate the order amount detals
    const { cart } = req.body;
    const { jsonResponse, httpStatusCode } = await createOrder(cart);
    res.status(httpStatusCode).json(jsonResponse);
  } catch (error) {
    console.error("Fallo en crear una ordenÑ ", error);
    res.status(500).json({ error: `Se fallo en crear una orden debido a esto: ${error}`});
  }
});

app.post("/api/orders/:orderID/capture", async (req, res) => {
  try {
    const { orderID } = req.params;
    const { jsonResponse, httpStatusCode } = await captureOrder(orderID);
    res.status(httpStatusCode).json(jsonResponse);
  } catch (error) {
    console.error("Failed to create order:", error);
    res.status(500).json({ error: "Failed to capture order." });
  }
});


app.get("/suscripciones", async (req,res) => {

  const url = "https://sandbox.paypal.com/v1/identity/openidconnect/userinfo";
  const token = await generateAccessToken();

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  })
  console.log(`Status del servidor ${response.status}`)
  return res.send(handleResponse(response))
  
});
// render checkout page with client id & unique client token
app.get("/", async (req, res) => {
  try {
    res.render("checkout", {
      clientId: PAYPAL_CLIENT_ID,
    });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.listen(PORT, () => {
  console.log(process.env.PAYPAL_CLIENT_ID)
  console.log(`Node server listening at http://localhost:${PORT}/`);
});


