# remote-promises

An ES6 library to add a network abstraction between calls to and fulfillment of function promises

# Usage (typical operation)

Instead of being confined to a single application running on a single processor:

```javascript
	function somePromiseFunction(){ return new Promise( ... ) }

	somePromiseFunction( args )
		.then( ... )
		.catch( ... )
		.finally( ... );

```


With remote-promises, we can move the handling of the function to a different process or machine.

In the typical configuration, the function is handled by a system that also acts as a server. The function is called by a system that is acts as the client. For this configuration we use the `.serve()` and `.client()` methods.

For example to move the above call to a function server called `some_server`, it would just require:


```javascript
	function somePromiseFunction(){ return new Promise( ... ) }

	RemotePromise.serve( somePromiseFunction, 3000, { path: "somePath" } );
```

and from some other process/system do:

```javascript
	const somePromiseFunction = RemotePromise.client( "ws://some_server:3000/somePath" );

	somePromiseFunction( args )
		.then( ... )
		.catch( ... )
		.finally( ... );
```


Of course remote-promises works with regular functions as well. In this case it converts them into promise functions, e.g.:


```javascript
	function simple(){ return "success"; }

	RemotePromise.serve( simple, 3000, { path: "somePath" } );
```

```javascript
	const simpleAsPromise = RemotePromise.client( "ws://some_server:3000/somePath" );

	simpleAsPromise( args )
		.then( ... )
		.catch( ... )
		.finally( ... );
```


# Usage (flipped operation)

In most configurations, the callee is the client and the function handler is the server, but it can also be reversed. 

For flipped operation the callee acts as a server, using the `.marshal()` methed, and the function handler acts as a network client using the `.provide()` method.


```javascript
	function somePromiseFunction(){ return new Promise( ... ) }

	RemotePromise.provide( somePromiseFunction, "ws://some_server:3000/somePath" );	
```

and from some other process/system do:

```javascript
	const somePromiseFunction = await RemotePromise.marshal( 3000, { path: "somePath" } );

	somePromiseFunction( args )
		.then( ... )
		.catch( ... )
		.finally( ... );
```


## Multiple providers

In flipped operation, a server that is marshalling ( via `.marshal()` ) can accept multiple providers ( via `.provide()`. In such a case, the work is delegated in turn to provider with the lowest number of outstanding requests.

Note that there are no constraints requiring that the implementation of each function be identical, which could lead to some unanticipated effects.


# Await

As with all promise returning functions, remote-promises can be used with the `await` construct. E.g.:

```javascript
	const somePromiseFunction = await RemotePromise.marshal( 3000, { path: "somePath" } );
	
	try {
		const result = await somePromiseFunction( args );
		...
	}
	catch ( err ){
		...
	}
```


# Closing connections

All remote-promise methods return an object with a `close()` method that can be used to terminate that end of the connection.

Eg:

```javascript
	function somePromiseFunction(){ return new Promise( ... ) }

  const server = RemotePromise.serve( somePromiseFunction, 3000, { path: "somePath" } );
	const remoteFunction = RemotePromise.client( "ws://some_server:3000/somePath" );

	server.close();
	remoteFunction.close();

  const provider = RemotePromise.provide( somePromiseFunction, "ws://some_server:3000/somePath" );	
	const marshalledFunction = await RemotePromise.marshal( 3000, { path: "somePath" } );

	provider.close();
	marshalledFunction.close();
```




--------------

# API

## Serve

* serve ( func, port[, options?] )
* frpfsServe ( func, port[, options?] )
* frpfsFunctionServer ( func[, options?] )

Offers a function for execution for clients who connect via the `.client()` method described below

_**func**_ 
> a function that returns a promise ( or, equivalently, an async function ).

_**port**_
> the port number on which the service should be offered

-**options**_
> Other server options, see socket.io

-**returns**_
> A RemotePromiseServer object, which can be closed via a `close()` call.


## Client

* client ( url )
* ffpClient ( url )
* ffpCallerClient ( url )

Get a function that executes functionality offered on a server that is offering functionalty via the `serve()` method above.

_**url**_
> A web socket url, served via the `serve()` method

_**returns**_
> Returns a function that returns a promise that resolves with the result of the function as executed on the system running the `serve()` call.
> 
> The returned function contains a  `close()` method that can be used to disconnect the client



## Provide

* provide ( func, url )
* frpfcProvide ( func, url )
* frpfcFuncitonClient ( func, url )

Offers a function for execution to a remote server that is marshalling functionalty via the `.marshal()` method below

_**func**_ 
> a function that returns a promise ( or, equivalently, an async function ).

_**url**_
> A web socket url, being marshaled via the `marshal()` method

_**returns**_
> Returns remote-promise server that can be closed via a call to `close()`


## Marshal

* marshal ( port[, options?] )
* ffpMarshal ( port[, options?] )
* ffpCallerServer ( port[, options?] )

Opens a marshalling service for providers to offer functions for execution via the `.provide()` method above


_**port**_
> the port number to which the service should be provided via a `provide()` call

_**options**_
> Other server options, see socket.io

* returns
> Returns a function that returns a promise that resolves with the result of the function as executed on the system running the `provide()` call.
> 
> The returned function contains a `close()` method that can be used to end the marshalling service.


