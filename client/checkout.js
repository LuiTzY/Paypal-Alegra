
//Esta funcion se encargara de generar la orden
async function createOrderCallback() {
  //Vamos a llamar al endpoint de las ordenes por POST enviandole nuestro id de producto y el precio del mismo
  try {
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      // use the "body" param to optionally pass additional order information
      // like product ids and quantities\
      //Se convierte el json en stringify para pasarlo a texto tecniamente seria como convertilo en un formato 
      //valido para que la api de paypal lo pueda entender pero seguira siendo un json
      body: JSON.stringify({
        cart: [
          {
            //El id del producto
            id: "YOUR_PRODUCT_ID",
            //El valor del producto
            quantity: "YOUR_PRODUCT_QUANTITY",
          },
        ],
      }),
    });

    //Esperamos la respuesta
    const orderData = await response.json();

    //Si tenemos un id dentro de la respuesta obtenida es xq se genero correctamente la orden
    if (orderData.id) {
      //Retornamos la informacion de la orden
      return orderData.id;
    } else {
      //Caso contrario no se genero correctamente, por lo que se mostrara el error que ocurrio
      const errorDetail = orderData?.details?.[0];
      const errorMessage = errorDetail
        ? `${errorDetail.issue} ${errorDetail.description} (${orderData.debug_id})`
        : JSON.stringify(orderData);

      throw new Error(errorMessage);
    }
  } catch (error) {
    //Capturamos cualquier error interno que pueda ocurrir
    console.error(error);
    resultMessage(`Could not initiate PayPal Checkout...<br><br>${error}`);
  }
}

//Esta funcion se encargara de generar la orden al aprobar el pago desde el cliente
async function onApproveCallback(data, actions) {
  //Intenta hacer la solicitud al endpoint de orders para generar una orden por POST
  try {
    const response = await fetch(`/api/orders/${data.orderID}/capture`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    //Se obtienen los datos de la respuesta que seria losd atos de la orden tecnicamente
    const orderData = await response.json();
    // Three cases to handle:
    //   (1) Recoverable INSTRUMENT_DECLINED -> call actions.restart()
    //   (2) Other non-recoverable errors -> Show a failure message
    //   (3) Successful transaction -> Show confirmation or thank you message

    const transaction =
      orderData?.purchase_units?.[0]?.payments?.captures?.[0] ||
      orderData?.purchase_units?.[0]?.payments?.authorizations?.[0];
    const errorDetail = orderData?.details?.[0];

    // this actions.restart() behavior only applies to the Buttons component
    if (errorDetail?.issue === "INSTRUMENT_DECLINED" && !data.card && actions) {
      // (1) Recoverable INSTRUMENT_DECLINED -> call actions.restart()
      // recoverable state, per https://developer.paypal.com/docs/checkout/standard/customize/handle-funding-failures/
      return actions.restart();
    } else if (
      errorDetail ||
      !transaction ||
      transaction.status === "DECLINED"
    ) {
      // (2) Other non-recoverable errors -> Show a failure message
      let errorMessage;
      if (transaction) {
        errorMessage = `Transaction ${transaction.status}: ${transaction.id}`;
      } else if (errorDetail) {
        errorMessage = `${errorDetail.description} (${orderData.debug_id})`;
      } else {
        errorMessage = JSON.stringify(orderData);
      }

      throw new Error(errorMessage);
    } else {
      // (3) Successful transaction -> Show confirmation or thank you message
      // Or go to another URL:  actions.redirect('thank_you.html');
      resultMessage(
        `Transaction ${transaction.status}: ${transaction.id}<br><br>See console for all available details`,
      );
      console.log(
        "Capture result",
        orderData,
        JSON.stringify(orderData, null, 2),
      );
    }
  } catch (error) {
    console.error(error);
    resultMessage(
      `Sorry, your transaction could not be processed...<br><br>${error}`,
    );
  }
}
//SDK de paypal que genera los botones para crear una orden y una funcoon de onapprove del pago
//Esto seria basicamente para paserle estas funciones a mis cardfields que voy a renderizar
window.paypal
  .Buttons({
    createOrder: createOrderCallback,
    onApprove: onApproveCallback,
  })
  .render("#paypal-button-container");

const cardField = window.paypal.CardFields({
  createOrder: createOrderCallback,
  onApprove: onApproveCallback,
});

// Render each field after checking for eligibility
if (cardField.isEligible()) {
  const nameField = cardField.NameField();
  nameField.render("#card-name-field-container");

  const numberField = cardField.NumberField();
  numberField.render("#card-number-field-container");

  const cvvField = cardField.CVVField();
  cvvField.render("#card-cvv-field-container");

  const expiryField = cardField.ExpiryField();
  expiryField.render("#card-expiry-field-container");

  // Agrega un clic al boton de submit para obtener los valores dentro de los campos 
  //Add click listener to submit button and call the submit function on the CardField component
  document
    .getElementById("card-field-submit-button")
    .addEventListener("click", () => {
      console.log("Aqui te capturamos el click ya que parace que vas a pagar")
      cardField
        .submit({
          // From your billing address fields
          billingAddress: {
            addressLine1: document.getElementById("card-billing-address-line-1")
              .value,
            addressLine2: document.getElementById("card-billing-address-line-2")
              .value,
            adminArea1: document.getElementById(
              "card-billing-address-admin-area-line-1",
            ).value,
            adminArea2: document.getElementById(
              "card-billing-address-admin-area-line-2",
            ).value,
            countryCode: document.getElementById(
              "card-billing-address-country-code",
            ).value,
            postalCode: document.getElementById(
              "card-billing-address-postal-code",
            ).value,
          },
        })
        .catch((error) => {
          resultMessage(
            `Sorry, your transaction could not be processed...<br><br>${error}`,
          );
        });
    });
} else {
  //Oculta los campos si no es elegivle el merchant
  // Hides card fields if the merchant isn't eligible
  document.querySelector("#card-form").style = "display: none";
}
// Mensaje que se le puede mostrar al cliente una vez se haya aplicado el pago
// Example function to show a result to the user. Your site's UI library can be used instead.
function resultMessage(message) {
  const container = document.querySelector("#result-message");
  container.innerHTML = message;
}
